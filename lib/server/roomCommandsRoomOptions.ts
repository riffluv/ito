import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import type { RoomDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";
import { buildRoomOptionsUpdates } from "@/lib/server/roomCommandsRoomOptions/helpers";

export async function updateRoomOptionsCommand(params: {
  token: string;
  roomId: string;
  resolveMode?: string | null;
  defaultTopicType?: string | null;
}) {
  const uid = await verifyViewerIdentity(params.token);
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const snap = await roomRef.get();
  if (!snap.exists) throw codedError("room_not_found", "room_not_found");
  const room = snap.data() as RoomDoc | undefined;
  const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
  if (!isHost) throw codedError("forbidden", "forbidden", "host_only");

  await roomRef.update(
    buildRoomOptionsUpdates({
      resolveMode: params.resolveMode,
      defaultTopicType: params.defaultTopicType,
      serverNow: FieldValue.serverTimestamp(),
    })
  );
  traceAction("room.options.update.server", {
    roomId: params.roomId,
    uid,
    resolveMode: params.resolveMode,
    defaultTopicType: params.defaultTopicType,
  });
}
