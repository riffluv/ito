import { FieldValue } from "firebase-admin/firestore";

import { getAdminRtdb } from "@/lib/server/firebaseAdmin";
import { releaseRoomLock } from "@/lib/server/roomQueue";
import { traceError } from "@/lib/utils/trace";
import type { RoomDoc } from "@/lib/types";
import { waitMs } from "@/lib/server/roomCommandCore";

export const releaseLockSafely = async (roomId: string, holder: string) => {
  try {
    await releaseRoomLock(roomId, holder);
  } catch (error) {
    traceError("room.lock.release", error, { roomId, holder });
  }
};

export const clearRoundPreparingWithRetry = async (params: {
  roomRef: FirebaseFirestore.DocumentReference;
  roomId: string;
  context: string;
}): Promise<boolean> => {
  const { roomRef, roomId, context } = params;
  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await roomRef.update({
        "ui.roundPreparing": false,
        lastActiveAt: FieldValue.serverTimestamp() as unknown as RoomDoc["lastActiveAt"],
      });
      return true;
    } catch (error) {
      traceError("ui.roundPreparing.clear.retry", error, { roomId, attempt, context });
      if (attempt < MAX_ATTEMPTS) {
        await waitMs(100);
      }
    }
  }
  return false;
};

export const fetchPresenceUids = async (roomId: string): Promise<string[] | null> => {
  const rtdb = getAdminRtdb();
  if (!rtdb) return null;
  try {
    const snap = await rtdb.ref(`presence/${roomId}`).get();
    const val =
      (snap.val() as Record<string, Record<string, { online?: boolean; ts?: number }>> | null) ?? {};
    const now = Date.now();
    const ACTIVE_WINDOW_MS = 30_000;
    const online: string[] = [];
    for (const [uid, conns] of Object.entries(val)) {
      const hasActive = Object.values(conns ?? {}).some((c) => {
        if (c?.online === false) return false;
        const ts = typeof c?.ts === "number" ? c.ts : 0;
        if (!ts) return true;
        return now - ts <= ACTIVE_WINDOW_MS;
      });
      if (hasActive) online.push(uid);
    }
    return online;
  } catch {
    return null;
  }
};

