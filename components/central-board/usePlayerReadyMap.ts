import { useMemo } from "react";
import type { PlayerDoc } from "@/lib/types";

export function usePlayerReadyMap(params: {
  playerMap: Map<string, PlayerDoc & { id: string }>;
}): Map<string, boolean> {
  const { playerMap } = params;

  return useMemo(() => {
    const map = new Map<string, boolean>();
    playerMap.forEach((player, id) => {
      const clue = typeof player?.clue1 === "string" ? player.clue1.trim() : "";
      map.set(id, clue.length > 0);
    });
    return map;
  }, [playerMap]);
}

