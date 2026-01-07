import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import { traceAction } from "@/lib/utils/trace";
import type { RoomDoc } from "@/lib/types";
import { codedError, sanitizeName } from "@/lib/server/roomCommandShared";
import { ensurePlayerDoc, verifyViewerIdentity } from "@/lib/server/roomCommandAuth";

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

  const dealPlayers = Array.isArray(room?.deal?.players) ? room!.deal!.players : [];
  const seatHistory =
    room?.deal && typeof room.deal === "object" && "seatHistory" in room.deal
      ? ((room.deal as { seatHistory?: Record<string, number> }).seatHistory ?? {})
      : {};
  const orderList = Array.isArray(room?.order?.list) ? room!.order!.list : [];
  const orderProposal = Array.isArray(room?.order?.proposal) ? room!.order!.proposal : [];
  const wasSeated =
    dealPlayers.includes(uid) ||
    typeof seatHistory?.[uid] === "number" ||
    orderList.includes(uid) ||
    orderProposal.includes(uid);

  const isHost = hostId === uid;

  if (!isHost && status !== "waiting" && !wasSeated) {
    throw codedError("in_progress", "room_in_progress");
  }

  if (!isHost && status === "waiting" && recallOpen === false && !wasSeated) {
    throw codedError("recall_closed", "room_recall_closed");
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

