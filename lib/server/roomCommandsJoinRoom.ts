import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { traceAction } from "@/lib/utils/trace";
import type { RoomDoc } from "@/lib/types";
import { codedError, sanitizeName } from "@/lib/server/roomCommandShared";
import { ensurePlayerDoc, verifyViewerIdentity } from "@/lib/server/roomCommandAuth";
import { deriveJoinGate, deriveWasSeated } from "@/lib/server/roomCommandsJoinRoom/helpers";

type WithAuth = { token: string };

export type JoinRoomParams = WithAuth & {
  roomId: string;
  displayName: string | null;
};

export async function joinRoom(params: JoinRoomParams) {
  const uid = await verifyViewerIdentity(params.token);
  const { roomId } = params;
  const db = getAdminDb();
  const roomRef = db.collection("rooms").doc(roomId);
  const roomSnap = await roomRef.get();
  if (!roomSnap.exists) {
    throw codedError("room_not_found", "room_not_found");
  }
  const room = roomSnap.data() as RoomDoc | undefined;
  const status = room?.status ?? "waiting";
  const recallOpen = room?.ui?.recallOpen ?? true;
  const hostId = room?.hostId ?? null;
  const wasSeated = deriveWasSeated({ uid, room });
  const gate = deriveJoinGate({
    uid,
    hostId,
    status,
    recallOpen,
    wasSeated,
  });
  if (!gate.ok) {
    throw codedError(gate.errorCode, gate.errorMessage);
  }

  const result = await ensurePlayerDoc({
    roomId,
    uid,
    displayName: params.displayName,
  });

  await roomRef.update({
    lastActiveAt: FieldValue.serverTimestamp(),
  });

  traceAction("room.join.server", { roomId, uid, joined: result.joined });

  if (result.joined) {
    try {
      await roomRef.collection("chat").add({
        sender: "system",
        text: `${sanitizeName(params.displayName ?? "匿名")} さんが参加しました`,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch {}
  }

  return result;
}
