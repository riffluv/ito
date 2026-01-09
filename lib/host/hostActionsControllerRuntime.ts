import { db } from "@/lib/firebase/client";
import type { RoomDoc } from "@/lib/types";
import { traceError } from "@/lib/utils/trace";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";

export type HostSessionProvider = {
  getSessionId?: () => string | null;
  ensureSession?: () => Promise<string | null>;
};

export function createSessionResolver(session?: HostSessionProvider) {
  return async (): Promise<string | null> => {
    try {
      const cached = session?.getSessionId?.() ?? null;
      if (cached) return cached;
      if (session?.ensureSession) {
        return (await session.ensureSession()) ?? null;
      }
    } catch (error) {
      traceError("ui.host.session.resolve", error);
    }
    return null;
  };
}

export function createRoomSnapshotFetcher() {
  return async (roomId: string): Promise<RoomDoc | null> => {
    if (!db) return null;
    try {
      const ref = doc(db, "rooms", roomId);
      const snap = await getDocFromServer(ref).catch(() => getDoc(ref));
      return (snap.data() as RoomDoc | undefined) ?? null;
    } catch (error) {
      traceError("ui.host.room.read", error, { roomId });
      return null;
    }
  };
}

