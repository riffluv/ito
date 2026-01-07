import { FieldValue, type Timestamp } from "firebase-admin/firestore";

import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { logWarn } from "@/lib/utils/log";

type RoomUpdateMap = Record<string, unknown>;

type WaitingResetOptions = {
  recallOpen?: boolean;
  resetRound?: boolean;
  clearTopic?: boolean;
  closedAt?: Timestamp | FieldValue | null;
  expiresAt?: Timestamp | FieldValue | null;
};

export function composeWaitingResetPayload(options?: WaitingResetOptions): RoomUpdateMap {
  const payload: RoomUpdateMap = {
    status: "waiting",
    result: null,
    deal: null,
    order: null,
  };

  if (options?.resetRound) {
    payload.round = 0;
  }

  if (options?.clearTopic) {
    payload.topic = null;
    payload.topicOptions = null;
    payload.topicBox = null;
  }

  if (options && "closedAt" in options) {
    payload.closedAt = options.closedAt;
  }

  if (options && "expiresAt" in options) {
    payload.expiresAt = options.expiresAt;
  }

  if (options?.recallOpen !== undefined) {
    payload["ui.recallOpen"] = options.recallOpen;
  } else {
    payload["ui.recallOpen"] = true;
  }
  // UI状態の後片付け（準備中・リビール待ち残留防止）
  payload["ui.roundPreparing"] = false;
  payload["ui.revealPending"] = false;
  payload["ui.revealBeginAt"] = FieldValue.delete();
  payload.startRequestId = null;
  payload.resetRequestId = options?.resetRound ? null : payload.resetRequestId ?? null;
  payload.nextRequestId = null;
  payload.dealRequestId = null;

  return payload;
}

export async function resetRoomToWaiting(roomId: string) {
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(roomId);
  const snap = await roomRef.get();
  if (!snap.exists) return;
  // NOTE: /api/rooms/[roomId]/reset が正規ルート。サーバーアクションのフォールバックでも同一ペイロードを適用する。
  const payload = composeWaitingResetPayload({
    recallOpen: false,
    resetRound: true,
    clearTopic: true,
    closedAt: null,
    expiresAt: null,
  });
  await roomRef.update(payload).catch(() => void 0);

  try {
    const playersSnap = await roomRef.collection("players").get();
    if (playersSnap.empty) return;
    const batch = db.batch();
    playersSnap.forEach((doc) => {
      batch.update(doc.ref, {
        number: null,
        clue1: "",
        ready: false,
        orderIndex: 0,
      });
    });
    await batch.commit();
  } catch (error) {
    logWarn("rooms", "reset-room-server-failed", error);
  }
}

