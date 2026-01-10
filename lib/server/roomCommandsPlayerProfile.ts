import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import type { RoomDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import { codedError, sanitizeName } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";
import {
  buildPlayerProfileUpdates,
  resolveTargetPlayerId,
  shouldRequireHostForProfileUpdate,
} from "@/lib/server/roomCommandsPlayerProfile/helpers";

export async function updatePlayerProfileCommand(params: {
  token: string;
  roomId: string;
  playerId?: string | null;
  name?: string | null;
  avatar?: string | null;
}) {
  const uid = await verifyViewerIdentity(params.token);
  const targetId = resolveTargetPlayerId({ uid, playerId: params.playerId });
  const db = getAdminDb();
  const playerRef = db.collection("rooms").doc(params.roomId).collection("players").doc(targetId);
  const playerSnap = await playerRef.get();
  if (!playerSnap.exists) throw codedError("forbidden", "forbidden", "not_member");
  if (shouldRequireHostForProfileUpdate({ uid, targetId })) {
    const roomSnap = await db.collection("rooms").doc(params.roomId).get();
    const room = roomSnap.data() as RoomDoc | undefined;
    const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
    if (!isHost) throw codedError("forbidden", "forbidden", "host_only");
  }

  await playerRef.update(
    buildPlayerProfileUpdates({
      lastSeen: FieldValue.serverTimestamp(),
      name: params.name,
      avatar: params.avatar,
      sanitizeName,
    })
  );
  traceAction("player.profile.update.server", { roomId: params.roomId, uid, targetId });
}
