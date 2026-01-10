import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import type { RoomDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";
import { buildRoundPreparingUpdate } from "@/lib/server/roomCommandsRoundPreparing/helpers";

export async function setRoundPreparingCommand(params: { token: string; roomId: string; active: boolean }) {
  const uid = await verifyViewerIdentity(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(roomRef);
    if (!snap.exists) throw codedError("room_not_found", "room_not_found");
    const room = snap.data() as RoomDoc;
    const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
    if (!isHost) throw codedError("forbidden", "forbidden", "host_only");
    tx.update(
      roomRef,
      buildRoundPreparingUpdate({
        active: params.active,
        lastActiveAt: FieldValue.serverTimestamp(),
      })
    );
  });

  traceAction("ui.roundPreparing.set.server", { roomId: params.roomId, uid, active: params.active });
}
