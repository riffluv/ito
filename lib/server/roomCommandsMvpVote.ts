import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";
import { traceAction } from "@/lib/utils/trace";
import { buildMvpVoteUpdates } from "@/lib/server/roomCommandsMvpVote/helpers";

export async function castMvpVoteCommand(params: { token: string; roomId: string; targetId: string | null }) {
  const uid = await verifyViewerIdentity(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const playerRef = roomRef.collection("players").doc(uid);
  const playerSnap = await playerRef.get();
  if (!playerSnap.exists) throw codedError("forbidden", "forbidden", "not_member");

  await roomRef.update(
    buildMvpVoteUpdates({
      uid,
      targetId: params.targetId,
      lastActiveAt: FieldValue.serverTimestamp(),
      fieldDelete: FieldValue.delete(),
    })
  );
  traceAction("mvp.vote.server", { roomId: params.roomId, uid, target: params.targetId ?? "" });
}
