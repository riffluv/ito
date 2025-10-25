import type { PlayerDoc } from "@/lib/types";

type PresenceArgs = {
  baseIds: readonly string[];
  onlineUids?: readonly string[] | null;
  presenceReady: boolean;
};

type ClueTargetArgs = {
  dealPlayers?: readonly unknown[] | null;
  eligibleIds: readonly string[];
};

type ClueReadyArgs = {
  players: ReadonlyArray<(PlayerDoc & { id: string }) | { id: string; ready?: boolean }>;
  targetIds: readonly string[];
};

export function getPresenceEligibleIds({
  baseIds,
  onlineUids,
  presenceReady,
}: PresenceArgs): string[] {
  if (!presenceReady) {
    return [...baseIds];
  }
  if (!Array.isArray(onlineUids) || onlineUids.length === 0) {
    return [...baseIds];
  }

  const onlineSet = new Set(onlineUids);
  const filtered = baseIds.filter((id) => onlineSet.has(id));

  if (filtered.length === 0) {
    return [...baseIds];
  }

  return filtered;
}

export function getClueTargetIds({
  dealPlayers,
  eligibleIds,
}: ClueTargetArgs): string[] {
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

export function areAllCluesReady({
  players,
  targetIds,
}: ClueReadyArgs): boolean {
  if (!Array.isArray(targetIds) || targetIds.length === 0) {
    return false;
  }

  const idSet = new Set(targetIds);
  const targets = players.filter((player) => idSet.has(player.id));

  return targets.length > 0 && targets.every((player) => player.ready === true);
}

