import type { PlayerDoc } from "@/lib/types";

export function deriveEffectiveOnlineUids(params: {
  presenceReady: boolean;
  presenceDegraded: boolean;
  onlineUids?: string[];
  stableOnlineUids?: string[];
}): string[] | undefined {
  const { presenceReady, presenceDegraded, onlineUids, stableOnlineUids } = params;
  if (presenceReady) return onlineUids;
  if (presenceDegraded && Array.isArray(stableOnlineUids)) {
    return stableOnlineUids;
  }
  return onlineUids;
}

export function deriveParticipants(params: {
  players: (PlayerDoc & { id: string })[];
  effectiveOnlineUids?: string[];
  presenceReady: boolean;
  presenceDegraded: boolean;
}): (PlayerDoc & { id: string })[] {
  const { players, effectiveOnlineUids, presenceReady, presenceDegraded } = params;
  if (
    !Array.isArray(effectiveOnlineUids) ||
    (!presenceReady && !presenceDegraded)
  ) {
    return players;
  }
  if (effectiveOnlineUids.length === 0) {
    return [];
  }
  const set = new Set(effectiveOnlineUids);
  return players.filter((p) => set.has(p.id));
}
