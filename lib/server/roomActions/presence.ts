import type { Database } from "firebase-admin/database";

import { MAX_CLOCK_SKEW_MS, PRESENCE_STALE_MS } from "@/lib/constants/presence";
import type { PresenceConn, PresenceRoomMap, PresenceUserMap } from "@/lib/firebase/presence";

function isConnectionActive(
  conn: PresenceConn | Record<string, unknown> | null | undefined,
  now: number
): boolean {
  if (!conn) return false;
  const record = conn as PresenceConn;
  if (record.online === false) return false;
  if (record.online === true && typeof record.ts !== "number") return true;
  const ts = typeof record.ts === "number" ? record.ts : 0;
  if (!ts) return false;
  if (ts - now > MAX_CLOCK_SKEW_MS) return false;
  return now - ts <= PRESENCE_STALE_MS;
}

export async function fetchPresenceUids(roomId: string, db: Database): Promise<string[]> {
  try {
    const snap = await db.ref(`presence/${roomId}`).get();
    const val = (snap.val() as PresenceRoomMap | null) ?? {};
    const now = Date.now();
    return Object.keys(val).filter((uid) => {
      const conns = val[uid] ?? ({} as PresenceUserMap);
      return Object.values(conns).some((c) => isConnectionActive(c, now));
    });
  } catch {
    return [];
  }
}

export async function forceDetachAll(roomId: string, uid: string, db: Database | null) {
  if (!db) return;
  try {
    const baseRef = db.ref(`presence/${roomId}/${uid}`);
    const snap = await baseRef.get();
    const val = snap.val() as PresenceUserMap | null;
    if (!val) return;
    await Promise.all(
      Object.keys(val).map((connId) =>
        baseRef
          .child(connId)
          .remove()
          .catch(() => void 0)
      )
    );
    await baseRef.remove().catch(() => void 0);
  } catch {}
}

