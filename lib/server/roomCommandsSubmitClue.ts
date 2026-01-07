import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { traceAction } from "@/lib/utils/trace";
import { sanitizeClue } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";

type WithAuth = { token: string };

export type SubmitClueParams = WithAuth & {
  roomId: string;
  clue: string;
};

export async function submitClue(params: SubmitClueParams) {
  const uid = await verifyViewerIdentity(params.token);
  const clue = sanitizeClue(params.clue);
  const db = getAdminDb();
  await db
    .collection("rooms")
    .doc(params.roomId)
    .collection("players")
    .doc(uid)
    .update({
      clue1: clue,
      ready: true,
      lastSeen: FieldValue.serverTimestamp(),
    });
  traceAction("clue.submit.server", { roomId: params.roomId, uid });
}

