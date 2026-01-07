import { FieldValue } from "firebase-admin/firestore";
import type { RoomDoc, PlayerDoc } from "@/lib/types";
import { toMillis } from "@/lib/time";
import { codedError } from "@/lib/server/roomCommandShared";
import { buildDealPayload } from "@/lib/game/domain";

export async function runStartGameTransaction(params: {
  db: FirebaseFirestore.Firestore;
  roomRef: FirebaseFirestore.DocumentReference;
  playersSnap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;
  uid: string;
  requestId: string;
  allowFromFinished: boolean;
  allowFromClue: boolean;
  doAutoDeal: boolean;
  preparedDeal:
    | {
        dealPayload: ReturnType<typeof buildDealPayload>;
        orderedPlayers: { id: string }[];
        topic: string | null;
        topicBox: RoomDoc["topicBox"] | "カスタム" | null;
      }
    | null;
}): Promise<{
  alreadyStarted: boolean;
  prevStatus: RoomDoc["status"] | null;
  nextStatusVersion: number;
  syncTopic: string | null;
  syncTopicBox: RoomDoc["topicBox"] | null;
}> {
  let alreadyStarted = false;
  let prevStatus: RoomDoc["status"] | null = null;
  let nextStatusVersion = 0;
  let syncTopic: string | null = null;
  let syncTopicBox: RoomDoc["topicBox"] | null = null;

  const rateLimitMs = 700;

  await params.db.runTransaction(async (tx) => {
    const snap = await tx.get(params.roomRef);
    if (!snap.exists) {
      throw codedError("room_not_found", "room_not_found");
    }
    const room = snap.data() as RoomDoc;
    prevStatus = room.status ?? null;
    const currentStatusVersion = typeof room.statusVersion === "number" ? room.statusVersion : 0;

    // Idempotent: 同じ requestId で既に clue になっていれば成功扱いで何もしない
    if (room.startRequestId && room.startRequestId === params.requestId && room.status === "clue") {
      alreadyStarted = true;
      nextStatusVersion = currentStatusVersion;
      syncTopic = room.topic ?? null;
      syncTopicBox = (room.topicBox as RoomDoc["topicBox"] | null | undefined) ?? null;
      return;
    }

    // Rate limit (per room): 拒否してクライアントにリトライさせる
    const lastMs = toMillis(room.lastCommandAt);
    const nowMs = Date.now();
    const existingNumbers =
      room && typeof room.deal === "object" && room.deal
        ? (room.deal as { numbers?: Record<string, unknown> | undefined }).numbers
        : undefined;
    const isFreshWaiting =
      (room.status === "waiting" || room.status === "reveal" || room.status === "finished") &&
      (!existingNumbers || Object.keys(existingNumbers).length === 0);
    const canBypassRateLimit = isFreshWaiting;
    if (!canBypassRateLimit && lastMs !== null && nowMs - lastMs < rateLimitMs) {
      throw codedError("rate_limited", "rate_limited");
    }

    // allowFromFinished が true の場合、reveal/finished 状態からも開始可能
    // これにより「次のゲーム」ボタン押下時のレース条件を解消
    // allowFromClue が true の場合、clue 状態からも開始可能（リトライ時のレース条件対策）
    const validStatuses: RoomDoc["status"][] = ["waiting"];
    if (params.allowFromFinished) {
      validStatuses.push("reveal", "finished");
    }
    if (params.allowFromClue) {
      validStatuses.push("clue");
    }

    if (!validStatuses.includes(room.status)) {
      throw codedError("invalid_status", "invalid_status", `status_is_${room.status}`);
    }
    if (room.hostId && room.hostId !== params.uid) {
      throw codedError("forbidden", "forbidden", "host_only");
    }
    nextStatusVersion = currentStatusVersion + 1;
    const payload: Partial<RoomDoc> = {
      status: "clue",
      result: null,
      deal: params.doAutoDeal && params.preparedDeal ? params.preparedDeal.dealPayload : null,
      order:
        params.doAutoDeal && params.preparedDeal
          ? {
              list: [],
              lastNumber: null,
              failed: false,
              failedAt: null,
              total: params.preparedDeal.orderedPlayers.length,
              numbers: params.preparedDeal.dealPayload.numbers,
            }
          : null,
      mvpVotes: {},
      lastActiveAt: FieldValue.serverTimestamp() as unknown as RoomDoc["lastActiveAt"],
      ui: { ...(room.ui ?? {}), recallOpen: false, roundPreparing: false, revealPending: false },
      startRequestId: params.requestId,
      dealRequestId: params.doAutoDeal && params.preparedDeal ? params.requestId : room.dealRequestId ?? null,
      lastCommandAt: FieldValue.serverTimestamp() as unknown as RoomDoc["lastCommandAt"],
      statusVersion: nextStatusVersion,
    };

    if (params.doAutoDeal && params.preparedDeal) {
      payload.topic = params.preparedDeal.topic;
      payload.topicBox = params.preparedDeal.topicBox as RoomDoc["topicBox"] | null;
      payload.topicOptions = null;
      payload.deal = params.preparedDeal.dealPayload;
      syncTopic = params.preparedDeal.topic;
      syncTopicBox = (params.preparedDeal.topicBox as RoomDoc["topicBox"] | null) ?? null;
    } else {
      syncTopic = room.topic ?? null;
      syncTopicBox = (room.topicBox as RoomDoc["topicBox"] | null | undefined) ?? null;
    }

    tx.update(params.roomRef, payload);

    // Atomic: room + players reset must move together to avoid "room started but players stale".
    params.playersSnap.forEach((docSnap) => {
      const pid = docSnap.id;
      if (params.doAutoDeal && params.preparedDeal) {
        const seatIndex =
          typeof params.preparedDeal.dealPayload.seatHistory?.[pid] === "number"
            ? params.preparedDeal.dealPayload.seatHistory[pid]!
            : 0;
        tx.update(docSnap.ref, {
          number: params.preparedDeal.dealPayload.numbers[pid] ?? null,
          clue1: "",
          ready: false,
          orderIndex: seatIndex,
          lastSeen: FieldValue.serverTimestamp(),
        } satisfies Partial<PlayerDoc>);
      } else {
        tx.update(docSnap.ref, { number: null, clue1: "", ready: false, orderIndex: 0 });
      }
    });
  });

  return { alreadyStarted, prevStatus, nextStatusVersion, syncTopic, syncTopicBox };
}
