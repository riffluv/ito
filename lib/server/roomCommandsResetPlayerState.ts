import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import { codedError } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";
import {
  buildResetPlayerStateUpdate,
  resolveTargetPlayerId,
  shouldRequireHostForReset,
} from "@/lib/server/roomCommandsResetPlayerState/helpers";

export async function resetPlayerStateCommand(params: { token: string; roomId: string; playerId?: string | null }) {
  const uid = await verifyViewerIdentity(params.token);
  const targetId = resolveTargetPlayerId({ uid, playerId: params.playerId });
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(params.roomId);
  const playerRef = roomRef.collection("players").doc(targetId);
  const playerSnap = await playerRef.get();
  if (!playerSnap.exists) throw codedError("forbidden", "forbidden", "not_member");

  if (shouldRequireHostForReset({ uid, targetId })) {
    const roomSnap = await roomRef.get();
    const room = roomSnap.data() as RoomDoc | undefined;
    const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
    if (!isHost) throw codedError("forbidden", "forbidden", "host_only");
  }

  await playerRef.update(buildResetPlayerStateUpdate({ lastSeen: FieldValue.serverTimestamp() }) as Partial<PlayerDoc>);

  traceAction("player.resetState.server", { roomId: params.roomId, uid, targetId });
}
