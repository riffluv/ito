import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import type { RoomDoc } from "@/lib/types";
import { traceError } from "@/lib/utils/trace";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";

export async function continueAfterFailCommand(params: { token: string; roomId: string }) {
  const uid = await verifyViewerIdentity(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const snap = await roomRef.get();
  if (!snap.exists) throw codedError("room_not_found", "room_not_found");
  const room = snap.data() as RoomDoc | undefined;
  if (room?.hostId && room.hostId !== uid) {
    throw codedError("forbidden", "forbidden", "host_only");
  }
  if (room?.status !== "reveal" && room?.status !== "finished") {
    throw codedError("invalid_status", "invalid_status");
  }

  await roomRef.update({
    status: "waiting",
    result: null,
    order: null,
    deal: null,
    mvpVotes: {},
    lastActiveAt: FieldValue.serverTimestamp(),
    statusVersion: FieldValue.increment(1) as unknown as number,
  });

  try {
    const playersSnap = await roomRef.collection("players").get();
    const batch = db.batch();
    playersSnap.forEach((docSnap) => {
      batch.update(docSnap.ref, { clue1: "", ready: false, number: null, orderIndex: 0 });
    });
    await batch.commit();
  } catch (error) {
    traceError("continueAfterFail.resetPlayers", error, { roomId: params.roomId });
  }
}

