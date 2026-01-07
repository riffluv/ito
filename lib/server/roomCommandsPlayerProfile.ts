import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import { codedError, sanitizeName } from "@/lib/server/roomCommandShared";
import { verifyViewerIdentity } from "@/lib/server/roomCommandAuth";

export async function updatePlayerProfileCommand(params: {
  token: string;
  roomId: string;
  playerId?: string | null;
  name?: string | null;
  avatar?: string | null;
}) {
  const uid = await verifyViewerIdentity(params.token);
  const targetId = params.playerId && params.playerId.trim().length > 0 ? params.playerId : uid;
  const db = getAdminDb();
  const playerRef = db.collection("rooms").doc(params.roomId).collection("players").doc(targetId);
  const playerSnap = await playerRef.get();
  if (!playerSnap.exists) throw codedError("forbidden", "forbidden", "not_member");
  if (targetId !== uid) {
    const roomSnap = await db.collection("rooms").doc(params.roomId).get();
    const room = roomSnap.data() as RoomDoc | undefined;
    const isHost = !room?.hostId || room.hostId === uid || room?.creatorId === uid;
    if (!isHost) throw codedError("forbidden", "forbidden", "host_only");
  }

  const updates: Partial<PlayerDoc> & Record<string, unknown> = {
    lastSeen: FieldValue.serverTimestamp() as unknown as PlayerDoc["lastSeen"],
  };
  if (typeof params.name === "string" && params.name.trim().length > 0) {
    updates.name = sanitizeName(params.name);
  }
  if (typeof params.avatar === "string" && params.avatar.trim().length > 0) {
    updates.avatar = params.avatar;
  }

  await playerRef.update(updates);
  traceAction("player.profile.update.server", { roomId: params.roomId, uid, targetId });
}

