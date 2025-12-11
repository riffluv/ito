import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// Reserved for future durable queue expansion. Keep to document payload shape.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type QueueItem = {
  type: "start" | "reset" | "next" | "deal";
  createdAt: number;
  requestId: string;
  payload: Record<string, unknown>;
};

const QUEUE_COLLECTION = "roomCommandLocks";

/**
 * Room-level command lock/queue (best-effort):
 * - We store a single doc per room with {locked: boolean, updatedAt}.
 * - acquireLock tries to set locked=false->true via transaction.
 * - releaseLock sets locked=false.
 * This is not a durable queue, but enough to serialize Start/Reset/NextRound/Deal
 * in our current Firebase architecture.
 */

export async function acquireRoomLock(roomId: string, holder: string, ttlMs = 8000) {
  const db = getAdminDb();
  const ref = db.collection(QUEUE_COLLECTION).doc(roomId);
  const now = Date.now();
  let acquired = false;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as { locked?: boolean; updatedAt?: number; holder?: string }) : {};
    const locked = data.locked === true;
    const stale = typeof data.updatedAt === "number" && now - data.updatedAt > ttlMs;
    if (!locked || stale) {
      tx.set(ref, { locked: true, updatedAt: now, holder }, { merge: true });
      acquired = true;
    }
  });

  return acquired;
}

export async function releaseRoomLock(roomId: string, holder: string) {
  const db = getAdminDb();
  const ref = db.collection(QUEUE_COLLECTION).doc(roomId);
  await ref.set({ locked: false, holder, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}
