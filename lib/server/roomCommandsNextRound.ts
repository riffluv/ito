import { FieldValue } from "firebase-admin/firestore";

import type { RoomDoc } from "@/lib/types";
import { toMillis } from "@/lib/time";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import {
  clearRoundPreparingWithRetry,
  codedError,
  releaseLockSafely,
} from "@/lib/server/roomCommandShared";
import { acquireRoomLock } from "@/lib/server/roomQueue";
import type { RoomSyncPatch } from "@/lib/sync/roomSyncPatch";
import { traceAction, traceError } from "@/lib/utils/trace";
import { verifyHostIdentity } from "@/lib/server/roomCommandAuth";
import { auditNextRound } from "@/lib/server/nextRound/auditNextRound";
import { commitNextRoundBatch } from "@/lib/server/nextRound/commitNextRoundBatch";
import { prepareNextRoundDeal } from "@/lib/server/nextRound/prepareNextRoundDeal";
import { publishNextRoundSync } from "@/lib/server/nextRound/publishNextRoundSync";
import {
  buildNextFailureTrace,
  buildNextLockHolder,
  buildNextLockedTrace,
  isAllowedNextRoundStatus,
  isIdempotentNextRound,
  shouldRateLimit,
} from "@/lib/server/roomCommandsNextRound/helpers";

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
  const lockHolder = buildNextLockHolder(params.requestId);
  const locked = await acquireRoomLock(params.roomId, lockHolder);
  if (!locked) {
    traceAction(
      "room.next.locked",
      buildNextLockedTrace({
        roomId: params.roomId,
        requestId: params.requestId,
        holder: lockHolder,
      })
    );
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
    if (room?.status && !isAllowedNextRoundStatus(room.status)) {
      throw codedError(
        "invalid_status",
        "invalid_status",
        `status_is_${room.status}`
      );
    }

    // Idempotent: 直前と同じ requestId ですでに遷移済みならそのまま返す
    if (
      isIdempotentNextRound({
        nextRequestId: room?.nextRequestId ?? null,
        requestId: params.requestId,
        status: room?.status ?? null,
      })
    ) {
      const playerCount = Array.isArray(room?.deal?.players)
        ? room.deal!.players!.length
        : 0;
      const sync = publishNextRoundSync({
        roomId: params.roomId,
        statusVersion: typeof room?.statusVersion === "number" ? room.statusVersion : 0,
        requestId: params.requestId,
        ts: syncTs,
        topic: room?.topic ?? null,
        topicBox: (room?.topicBox as RoomDoc["topicBox"] | null | undefined) ?? null,
        round: typeof room?.round === "number" ? room.round : 0,
      });
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
    if (
      shouldRateLimit({
        lastCommandMs: lastMs,
        nowMs: Date.now(),
        rateLimitMs,
      })
    ) {
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
    const { ordered, topic, topicBox, seed, dealPayload } = await prepareNextRoundDeal({
      roomId: params.roomId,
      room,
      playersSnap,
      topicType: params.topicType ?? null,
      customTopic: params.customTopic ?? null,
      presenceUids: params.presenceUids ?? null,
    });

    // 7. 新しい round 番号
    const currentRound = typeof room?.round === "number" ? room.round : 0;
    const nextRound = currentRound + 1;
    const currentStatusVersion =
      typeof room?.statusVersion === "number" ? room.statusVersion : 0;
    const nextStatusVersion = currentStatusVersion + 1;
    await commitNextRoundBatch({
      db,
      roomRef,
      roomId: params.roomId,
      requestId: params.requestId,
      nextRound,
      nextStatusVersion,
      topic,
      topicBox,
      seed,
      dealPayload,
      orderedCount: ordered.length,
      playersSnap,
    });
    roundPreparingActivated = false;

    auditNextRound({
      roomId: params.roomId,
      uid,
      requestId: params.requestId,
      prevStatus: room?.status ?? null,
      playerCount: ordered.length,
      topicType: topicBox ?? null,
      topic,
      round: nextRound,
    });

    const sync = publishNextRoundSync({
      roomId: params.roomId,
      statusVersion: nextStatusVersion,
      requestId: params.requestId,
      ts: syncTs,
      topic,
      topicBox: (topicBox as RoomDoc["topicBox"] | null) ?? null,
      round: nextRound,
    });

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
      traceError(
        "room.next.server.failure",
        error,
        buildNextFailureTrace({
          roomId: params.roomId,
          requestId: params.requestId,
          prevStatus: room?.status ?? null,
          failureRoom,
          locked,
        })
      );
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
