import type { RoomDoc } from "@/lib/types";

export function deriveRoundPlayersForFinalize(room: RoomDoc): string[] {
  const raw = Array.isArray(room?.deal?.players) ? (room.deal!.players as unknown[]) : [];
  return raw
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value): value is string => value.length > 0);
}

export function canFinalizeReveal(params: {
  uid: string;
  room: RoomDoc;
  roundPlayers: readonly string[];
}): boolean {
  const isParticipant = params.roundPlayers.includes(params.uid);
  const isHost = !params.room?.hostId || params.room.hostId === params.uid || params.room?.creatorId === params.uid;
  return isHost || isParticipant;
}

