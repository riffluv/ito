import { db } from "@/lib/firebase/client";
import {
  addDoc,
  collection,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import type { ShowtimeEventDoc } from "./types";

const SHOWTIME_COLLECTION = "showtime";
const RECENT_EVENT_LIMIT = 6;

export type ShowtimeEventWithId = ShowtimeEventDoc & { id: string };

export async function publishShowtimeEvent(
  roomId: string,
  payload: ShowtimeEventDoc
): Promise<string | null> {
  if (!db) {
    return null;
  }
  try {
    const ref = await addDoc(
      collection(db, "rooms", roomId, SHOWTIME_COLLECTION),
      {
        ...payload,
        round:
          typeof payload.round === "number" && Number.isFinite(payload.round)
            ? payload.round
            : null,
        status: typeof payload.status === "string" ? payload.status : null,
        success:
          typeof payload.success === "boolean" ? payload.success : null,
        revealedMs:
          typeof payload.revealedMs === "number" &&
          Number.isFinite(payload.revealedMs)
            ? payload.revealedMs
            : null,
        intentId: payload.intentId ?? null,
        source: payload.source ?? "intent",
        createdAt: serverTimestamp(),
      } satisfies ShowtimeEventDoc
    );
    return ref.id;
  } catch {
    return null;
  }
}

export function subscribeShowtimeEvents(
  roomId: string,
  handler: (event: ShowtimeEventWithId) => void
): Unsubscribe {
  if (!db) {
    return () => {};
  }
  const seen = new Set<string>();
  let initialized = false;
  const q = query(
    collection(db, "rooms", roomId, SHOWTIME_COLLECTION),
    orderBy("createdAt", "asc"),
    limitToLast(RECENT_EVENT_LIMIT)
  );
  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (!initialized) {
      snapshot.forEach((doc) => {
        seen.add(doc.id);
      });
      initialized = true;
      return;
    }
    snapshot.docChanges().forEach((change) => {
      if (change.type !== "added") return;
      if (seen.has(change.doc.id)) return;
      seen.add(change.doc.id);
      handler({ id: change.doc.id, ...(change.doc.data() as ShowtimeEventDoc) });
    });
  });
  return () => {
    try {
      unsubscribe();
    } catch {}
    seen.clear();
  };
}
