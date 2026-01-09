import type { PlayerDoc } from "@/lib/types";

type ClueTargetArgs = {
  dealPlayers?: readonly unknown[] | null;
  eligibleIds: readonly string[];
};

type ClueReadyArgs = {
  players: ReadonlyArray<(PlayerDoc & { id: string }) | { id: string; ready?: boolean }>;
  targetIds: readonly string[];
};

export function getClueTargetIds({ dealPlayers, eligibleIds }: ClueTargetArgs): string[] {
  if (Array.isArray(dealPlayers)) {
    const filtered = dealPlayers.filter(
      (pid): pid is string => typeof pid === "string" && pid.length > 0
    );

    if (filtered.length > 0) {
      return filtered;
    }
  }

  return [...eligibleIds];
}

export function areAllCluesReady({ players, targetIds }: ClueReadyArgs): boolean {
  if (!Array.isArray(targetIds) || targetIds.length === 0) {
    return false;
  }

  const idSet = new Set(targetIds);
  const targets = players.filter((player) => idSet.has(player.id));

  return targets.length > 0 && targets.every((player) => player.ready === true);
}

