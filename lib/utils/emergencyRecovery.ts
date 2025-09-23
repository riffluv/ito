import { db } from "@/lib/firebase/client";
import { logWarn } from "@/lib/utils/log";
import { collection, getDocs, writeBatch } from "firebase/firestore";

const CLEAR_FIELDS = {
  clue1: "",
  ready: false,
};

export async function verifyPlayerStatesCleared(roomId: string): Promise<boolean> {
  if (!db) return true;
  try {
    const playersRef = collection(db, "rooms", roomId, "players");
    const snapshot = await getDocs(playersRef);
    for (const player of snapshot.docs) {
      const data = player.data() as { ready?: boolean; clue1?: unknown };
      if (data?.ready === true) {
        return false;
      }
      if (typeof data?.clue1 === "string" && data.clue1.trim().length > 0) {
        return false;
      }
    }
    return true;
  } catch (error) {
    logWarn("emergencyRecovery", "verify-player-states-failed", error);
    throw error;
  }
}

export async function emergencyResetPlayerStates(roomId: string): Promise<void> {
  if (!db) return;
  try {
    const playersRef = collection(db, "rooms", roomId, "players");
    const snapshot = await getDocs(playersRef);
    if (snapshot.empty) return;
    const batch = writeBatch(db);
    snapshot.forEach((playerDoc) => {
      batch.update(playerDoc.ref, CLEAR_FIELDS);
    });
    await batch.commit();
  } catch (error) {
    logWarn("emergencyRecovery", "emergency-reset-player-states-failed", error);
    throw error;
  }
}
