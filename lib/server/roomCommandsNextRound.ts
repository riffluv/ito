import { FieldValue } from "firebase-admin/firestore";

import { buildDealPayload, selectDealTargetPlayers } from "@/lib/game/domain";
import { generateDeterministicNumbers } from "@/lib/game/random";
import type { OrderState } from "@/lib/game/rules";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { toMillis } from "@/lib/time";
import { pickOne, type TopicType } from "@/lib/topics";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { logRoomCommandAudit } from "@/lib/server/roomAudit";
import {
  clearRoundPreparingWithRetry,
  codedError,
  fetchPresenceUids,
  isTopicTypeValue,
  loadTopicSectionsFromFs,
  releaseLockSafely,
  safeTraceAction,
  sanitizeTopicText,
} from "@/lib/server/roomCommandShared";
import { acquireRoomLock } from "@/lib/server/roomQueue";
import { buildRoomSyncPatch, publishRoomSyncPatch } from "@/lib/server/roomSync";
import type { RoomSyncPatch } from "@/lib/sync/roomSyncPatch";
import { traceAction, traceError } from "@/lib/utils/trace";
import { verifyHostIdentity } from "@/lib/server/roomCommandAuth";

type WithAuth = { token: string };

// ============================================================================
// nextRoundCommand: 「次のゲーム」専用 API
// ============================================================================
// reset + start + topic選択 + deal をアトミックに実行する。
// これにより、クライアント側のレース条件やリトライロジックが不要になる。
// ============================================================================

export type NextRoundParams = WithAuth & {
  roomId: string;
  topicType?: string | null; // 省略時は room.options.defaultTopicType
  customTopic?: string | null; // カスタムお題（topicType が "カスタム" の場合）
  requestId: string;
  sessionId?: string;
  presenceUids?: string[] | null;
};

export type NextRoundResult = {
  ok: true;
  round: number;
  playerCount: number;
  topic: string | null;
  topicType: string | null;
  sync: RoomSyncPatch;
};

export async function nextRoundCommand(params: NextRoundParams): Promise<NextRoundResult> {
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const rateLimitMs = 700;
  const syncTs = Date.now();
  const lockHolder = `next:${params.requestId}`;
  const locked = await acquireRoomLock(params.roomId, lockHolder);
  if (!locked) {
    traceAction("room.next.locked", {
      roomId: params.roomId,
      requestId: params.requestId,
      holder: lockHolder,
    });
    throw codedError("rate_limited", "rate_limited");
  }
  let roundPreparingActivated = false;
  let room: RoomDoc | undefined;
  try {
    // 1. room 取得 & 権限チェック
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) {
      throw codedError("room_not_found", "room_not_found");
    }
    room = roomSnap.data() as RoomDoc | undefined;
    const uid = await verifyHostIdentity(
      room,
      params.token,
      params.roomId,
      params.sessionId ?? undefined
    );

    // ホストまたは作成者のみ実行可能
    const isHost =
      !room?.hostId || room.hostId === uid || room?.creatorId === uid;
    if (!isHost) {
      throw codedError("forbidden", "forbidden", "host_only");
    }

    // 2. 許可されるステータスをチェック
    //    - 通常: reveal / finished / waiting から実行
    //    - clue は「直前の開始処理中」に限り許容するが、本来は next-round を押せる UI には出ない想定。
    //      （status が想定外でもサーバー側で安全に弾けるよう、allowedStatuses は少し広めに取る）
    const allowedStatuses: RoomDoc["status"][] = [
      "reveal",
      "finished",
      "waiting",
      "clue",
    ];
    if (room?.status && !allowedStatuses.includes(room.status)) {
      throw codedError(
        "invalid_status",
        "invalid_status",
        `status_is_${room.status}`
      );
    }

    // Idempotent: 直前と同じ requestId ですでに遷移済みならそのまま返す
    if (
      room?.nextRequestId &&
      room.nextRequestId === params.requestId &&
      room.status === "clue"
    ) {
      const playerCount = Array.isArray(room?.deal?.players)
        ? room.deal!.players!.length
        : 0;
      const sync = buildRoomSyncPatch({
        roomId: params.roomId,
        statusVersion:
          typeof room?.statusVersion === "number" ? room.statusVersion : 0,
        room: {
          status: "clue",
          topic: room?.topic ?? null,
          topicBox:
            (room?.topicBox as RoomDoc["topicBox"] | null | undefined) ?? null,
          round: typeof room?.round === "number" ? room.round : 0,
          ui: { roundPreparing: false, recallOpen: false, revealPending: false },
        },
        command: "next-round",
        requestId: params.requestId,
        source: "api",
        ts: syncTs,
      });
      void publishRoomSyncPatch({ ...sync, meta: { ...sync.meta, source: "rtdb" } });
      return {
        ok: true,
        round: typeof room?.round === "number" ? room.round : 0,
        playerCount,
        topic: room?.topic ?? null,
        topicType: (room?.topicBox as string | null | undefined) ?? null,
        sync,
      };
    }

    // レートリミット（ルーム単位）
    const lastMs = room?.lastCommandAt ? toMillis(room.lastCommandAt) : null;
    if (lastMs !== null && Date.now() - lastMs < rateLimitMs) {
      throw codedError("rate_limited", "rate_limited");
    }

    // 次のゲーム開始はクライアントの round-preparing API に頼らず、
    // server-authoritative な next command 内で即座にUIを凍結する。
    try {
      await roomRef.update({
        "ui.roundPreparing": true,
        lastActiveAt: FieldValue.serverTimestamp(),
      });
      roundPreparingActivated = true;
    } catch (error) {
      traceError("ui.roundPreparing.next.begin", error, { roomId: params.roomId });
    }

    // 3. プレイヤー一覧を取得
    const playersSnap = await roomRef.collection("players").get();
    const now = Date.now();
    const presenceUids = params.presenceUids ?? (await fetchPresenceUids(params.roomId));
    const candidates = playersSnap.docs.map((d) => {
      const data = d.data() as PlayerDoc | undefined;
      const lastSeenRaw = (data as { lastSeen?: unknown })?.lastSeen;
      const lastSeen = (lastSeenRaw ?? null) as
        | number
        | FirebaseFirestore.Timestamp
        | Date
        | null;
      return {
        id: d.id,
        uid: typeof data?.uid === "string" ? data.uid : undefined,
        lastSeen,
      } as const;
    });

    // 4. 配布対象プレイヤーを選定
    const target = selectDealTargetPlayers(candidates, presenceUids, now);
    let ordered = [...target].sort((a, b) =>
      String(a.uid || a.id).localeCompare(String(b.uid || b.id))
    );

    // フォールバック: eligibleCount > 1 なのに ordered が 1 以下の場合
    const eligibleCount = candidates.filter(
      (c) => typeof c.uid === "string" && c.uid.trim().length > 0
    ).length;
    const suspectedMismatch = eligibleCount > 1 && ordered.length <= 1;
    if (suspectedMismatch) {
      const fallbackOrdered = [...candidates].sort((a, b) =>
        String(a.uid || a.id).localeCompare(String(b.uid || b.id))
      );
      if (fallbackOrdered.length > ordered.length) {
        ordered = fallbackOrdered;
      }
    }

    if (ordered.length === 0) {
      throw codedError("no_players", "no_players", "no_eligible_players");
    }

    // 5. topic を決定
    const sections = await loadTopicSectionsFromFs();
    const requestedTopicType =
      params.topicType ?? room?.options?.defaultTopicType ?? "通常版";
    const normalizedTopicType =
      typeof requestedTopicType === "string" && isTopicTypeValue(requestedTopicType)
        ? (requestedTopicType as TopicType)
        : ("通常版" as TopicType);

    let topic: string | null = null;
    let topicBox: string | null = room?.topicBox ?? normalizedTopicType;

    if (topicBox === "カスタム") {
      // カスタムお題の場合
      const customText = params.customTopic ? sanitizeTopicText(params.customTopic) : null;
      if (customText && customText.trim().length > 0) {
        topic = customText;
        topicBox = "カスタム";
      } else if (room?.topic && String(room.topicBox) === "カスタム") {
        // 前回のカスタムお題を引き継ぐ
        topic = room.topic;
        topicBox = "カスタム";
      } else {
        // カスタムお題がない場合は通常版にフォールバック
        const pool = sections.normal;
        topic = pickOne(pool) || null;
        topicBox = "通常版";
      }
    } else {
      // 標準お題の場合
      const pool =
        normalizedTopicType === "通常版"
          ? sections.normal
          : normalizedTopicType === "レインボー版"
            ? sections.rainbow
            : sections.classic;
      topic = pickOne(pool) || null;
    }

    // 6. numbers を生成
    const seed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const min = 1;
    const max = 100;
    const playerIds = ordered.map((p) => p.id);
    const generatedNumbers = generateDeterministicNumbers(playerIds.length, min, max, seed);
    const dealPayload = buildDealPayload(playerIds, seed, min, max, generatedNumbers);

    // 7. 新しい round 番号
    const currentRound = typeof room?.round === "number" ? room.round : 0;
    const nextRound = currentRound + 1;
    const currentStatusVersion =
      typeof room?.statusVersion === "number" ? room.statusVersion : 0;
    const nextStatusVersion = currentStatusVersion + 1;

    // 8. room を更新（アトミックに全てを設定）
    const roomUpdate: Record<string, unknown> = {
      status: "clue",
      round: nextRound,
      topic,
      topicBox,
      topicOptions: null,
      deal: dealPayload,
      order: {
        list: [],
        lastNumber: null,
        failed: false,
        failedAt: null,
        total: ordered.length,
      } satisfies OrderState,
      result: null,
      mvpVotes: {},
      lastActiveAt: FieldValue.serverTimestamp(),
      startRequestId: params.requestId,
      nextRequestId: params.requestId,
      dealRequestId: params.requestId,
      lastCommandAt: FieldValue.serverTimestamp(),
      statusVersion: nextStatusVersion,
      "ui.roundPreparing": false,
      "ui.recallOpen": false,
      "ui.revealPending": false,
    };

    // Atomic: room + players must move together to avoid "new round started, but some players still have old numbers/clues".
    try {
      const batch = db.batch();
      batch.update(roomRef, roomUpdate);

      playersSnap.forEach((doc) => {
        const pid = doc.id;
        const seatIndex =
          typeof dealPayload.seatHistory?.[pid] === "number"
            ? dealPayload.seatHistory[pid]!
            : 0;
        batch.update(doc.ref, {
          number: dealPayload.numbers[pid] ?? null,
          clue1: "",
          ready: false,
          orderIndex: seatIndex,
          lastSeen: FieldValue.serverTimestamp(),
        } satisfies Partial<PlayerDoc>);
      });

      batch.set(
        db.collection("roomProposals").doc(params.roomId),
        {
          proposal: [],
          seed,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();
      roundPreparingActivated = false;
    } catch (error) {
      traceError("room.nextRound.batch.commit", error, {
        roomId: params.roomId,
        requestId: params.requestId,
      });
      throw error;
    }

    traceAction("room.nextRound.server", {
      roomId: params.roomId,
      uid,
      requestId: params.requestId,
      prevStatus: room?.status ?? null,
      nextStatus: "clue",
      playerCount: ordered.length,
      topicType: topicBox ?? null,
    });
    void logRoomCommandAudit({
      roomId: params.roomId,
      uid,
      requestId: params.requestId,
      command: "next",
      prevStatus: room?.status ?? null,
      nextStatus: "clue",
      note: `playerCount:${ordered.length}`,
    });

    // 11. ログ出力
    safeTraceAction("nextRound.server", {
      roomId: params.roomId,
      uid,
      round: nextRound,
      playerCount: ordered.length,
      topicType: topicBox,
      topic: topic ?? undefined,
    });

    const sync = buildRoomSyncPatch({
      roomId: params.roomId,
      statusVersion: nextStatusVersion,
      room: {
        status: "clue",
        topic,
        topicBox: (topicBox as RoomDoc["topicBox"] | null) ?? null,
        round: nextRound,
        ui: { roundPreparing: false, recallOpen: false, revealPending: false },
      },
      command: "next-round",
      requestId: params.requestId,
      source: "api",
      ts: syncTs,
    });
    void publishRoomSyncPatch({ ...sync, meta: { ...sync.meta, source: "rtdb" } });

    return {
      ok: true,
      round: nextRound,
      playerCount: ordered.length,
      topic,
      topicType: topicBox,
      sync,
    };
  } catch (error) {
    try {
      const failureSnap = await roomRef.get();
      const failureRoom = failureSnap.exists
        ? (failureSnap.data() as RoomDoc)
        : undefined;
      traceError("room.next.server.failure", error, {
        roomId: params.roomId,
        requestId: params.requestId,
        prevStatus: room?.status ?? null,
        status: failureRoom?.status ?? null,
        roundPreparing: failureRoom?.ui?.roundPreparing ?? null,
        nextRequestId: failureRoom?.nextRequestId ?? null,
        locked: locked ? "1" : "0",
      });
    } catch (detailError) {
      traceError("room.next.server.failure.detail", detailError, {
        roomId: params.roomId,
        requestId: params.requestId,
      });
    }
    throw error;
  } finally {
    if (roundPreparingActivated) {
      const cleared = await clearRoundPreparingWithRetry({
        roomRef,
        roomId: params.roomId,
        context: "nextRoundCommand",
      });
      if (cleared) {
        roundPreparingActivated = false;
      }
    }
    await releaseLockSafely(params.roomId, lockHolder);
  }
}
