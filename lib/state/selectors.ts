import type { PlayerDoc, RoomDoc } from "@/lib/types";

export const isHost = (room: RoomDoc | null, uid: string | null | undefined) =>
  !!(room && uid && room.hostId === uid);

export const allNumbersDealt = (
  room: RoomDoc | null,
  onlinePlayers: (PlayerDoc & { id: string })[]
) =>
  !!room?.topic &&
  !!room?.deal &&
  Array.isArray((room.deal as any).players) &&
  onlinePlayers.every((p) => typeof p.number === "number");

export const eligiblePlayerIds = (
  room: RoomDoc | null,
  players: (PlayerDoc & { id: string })[],
  onlineIds: string[]
) => {
  const onlineSet = new Set(onlineIds);
  const baseIds = Array.isArray((room as any)?.deal?.players)
    ? Array.from(
        new Set<string>([
          ...(((room as any).deal.players as string[]) || []),
          ...players.map((p) => p.id),
        ])
      )
    : players.map((p) => p.id);
  return baseIds.filter((id) => onlineSet.has(id));
};

export const remainingCount = (
  room: RoomDoc | null,
  eligibleIds: string[]
) => {
  const played = new Set<string>((room as any)?.order?.list || []);
  return eligibleIds.filter((id) => !played.has(id)).length;
};

