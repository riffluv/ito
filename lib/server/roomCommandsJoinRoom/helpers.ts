import type { RoomDoc } from "@/lib/types";

export function deriveSeatHistory(room: RoomDoc | undefined): Record<string, number> {
  const deal = room?.deal;
  if (!deal || typeof deal !== "object") return {};
  if (!("seatHistory" in deal)) return {};
  const value = (deal as { seatHistory?: unknown }).seatHistory;
  return value && typeof value === "object" ? (value as Record<string, number>) : {};
}

export function deriveWasSeated(params: {
  uid: string;
  room: RoomDoc | undefined;
}): boolean {
  const dealPlayers = Array.isArray(params.room?.deal?.players)
    ? (params.room!.deal!.players as unknown[])
    : [];
  const seatHistory = deriveSeatHistory(params.room);
  const orderList = Array.isArray(params.room?.order?.list)
    ? (params.room!.order!.list as unknown[])
    : [];
  const orderProposal = Array.isArray(params.room?.order?.proposal)
    ? (params.room!.order!.proposal as unknown[])
    : [];

  return (
    dealPlayers.includes(params.uid) ||
    typeof seatHistory?.[params.uid] === "number" ||
    orderList.includes(params.uid) ||
    orderProposal.includes(params.uid)
  );
}

export function deriveJoinGate(params: {
  uid: string;
  hostId: string | null;
  status: RoomDoc["status"] | string;
  recallOpen: boolean;
  wasSeated: boolean;
}):
  | { ok: true }
  | { ok: false; errorCode: "in_progress" | "recall_closed"; errorMessage: string } {
  const isHost = params.hostId === params.uid;

  if (!isHost && params.status !== "waiting" && !params.wasSeated) {
    return { ok: false, errorCode: "in_progress", errorMessage: "room_in_progress" };
  }

  if (!isHost && params.status === "waiting" && params.recallOpen === false && !params.wasSeated) {
    return { ok: false, errorCode: "recall_closed", errorMessage: "room_recall_closed" };
  }

  return { ok: true };
}

