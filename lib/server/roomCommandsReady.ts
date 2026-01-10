import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { traceAction } from "@/lib/utils/trace";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";
import { buildReadyUpdate } from "@/lib/server/roomCommandsReady/helpers";

type WithAuth = { token: string };

export type UpdateReadyParams = WithAuth & {
  roomId: string;
  ready: boolean;
};

export async function updateReady(params: UpdateReadyParams) {
  const uid = await verifyViewerIdentity(params.token);
  const db = getAdminDb();
  await db
    .collection("rooms")
    .doc(params.roomId)
    .collection("players")
    .doc(uid)
    .update(buildReadyUpdate({ ready: params.ready, lastSeen: FieldValue.serverTimestamp() }));
  traceAction("player.ready.server", { roomId: params.roomId, uid, ready: params.ready });
}
