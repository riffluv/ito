"use client";

import { useMemo } from "react";

export function useRoomDealPlayers(dealPlayersRaw: unknown): string[] | null {
  return useMemo(() => {
    if (!Array.isArray(dealPlayersRaw)) {
      return null;
    }
    const filtered = dealPlayersRaw.filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0
    );
    return filtered.length > 0 ? filtered : null;
  }, [dealPlayersRaw]);
}

