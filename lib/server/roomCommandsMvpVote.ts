import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";
import { traceAction } from "@/lib/utils/trace";

export async function castMvpVoteCommand(params: { token: string; roomId: string; targetId: string | null }) {
  const uid = await verifyViewerIdentity(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const playerRef = roomRef.collection("players").doc(uid);
  const playerSnap = await playerRef.get();
  if (!playerSnap.exists) throw codedError("forbidden", "forbidden", "not_member");

  const fieldPath = `mvpVotes.${uid}`;
  const updates: Record<string, unknown> = {
    lastActiveAt: FieldValue.serverTimestamp(),
  };
  if (!params.targetId) {
    updates[fieldPath] = FieldValue.delete();
  } else {
    updates[fieldPath] = params.targetId;
  }

  await roomRef.update(updates);
  traceAction("mvp.vote.server", { roomId: params.roomId, uid, target: params.targetId ?? "" });
}

