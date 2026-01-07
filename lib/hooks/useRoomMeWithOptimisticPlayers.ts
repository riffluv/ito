import type { PlayerDoc } from "@/lib/types";
import { useMemo, useState } from "react";

type RoomPlayer = PlayerDoc & { id: string };

type UseRoomMeWithOptimisticPlayersParams = {
  uid: string | null;
  players: RoomPlayer[];
};

export function useRoomMeWithOptimisticPlayers(params: UseRoomMeWithOptimisticPlayersParams) {
  const { uid, players } = params;

  const meId = uid || "";
  const meFromPlayers = useMemo(
    () => players.find((player) => player.id === meId),
    [meId, players]
  );
  const [optimisticMe, setOptimisticMe] = useState<RoomPlayer | null>(null);
  const me = meFromPlayers ?? optimisticMe ?? null;

  const playersWithOptimistic = useMemo(() => {
    if (!optimisticMe) return players;
    if (players.some((player) => player.id === optimisticMe.id)) {
      return players;
    }
    return [...players, optimisticMe];
  }, [players, optimisticMe]);

  return {
    meId,
    meFromPlayers,
    optimisticMe,
    setOptimisticMe,
    me,
    playersWithOptimistic,
  } as const;
}

