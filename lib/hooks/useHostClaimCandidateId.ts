import { useMemo } from "react";

import { selectHostCandidate } from "@/lib/host/HostManager";

export function useHostClaimCandidateId(params: {
  roomId: string | null;
  players: Array<{
    id: string;
    name?: string | null | undefined;
    orderIndex?: number | null | undefined;
  }>;
  joinVersion: number;
  playerJoinOrderRef: React.MutableRefObject<Map<string, number>>;
  lastKnownHostId: string | null;
  stableHostId: string;
  presenceReady: boolean;
  onlineUids?: string[] | null | undefined;
  presenceLastSeenRef: React.MutableRefObject<Map<string, number>>;
  hostLikelyUnavailable: boolean;
  graceMs: number;
}): string | null {
  const {
    roomId,
    players,
    joinVersion,
    playerJoinOrderRef,
    lastKnownHostId,
    stableHostId,
    presenceReady,
    onlineUids,
    presenceLastSeenRef,
    hostLikelyUnavailable,
    graceMs,
  } = params;

  return useMemo(() => {
    if (!roomId || players.length === 0) {
      return null;
    }

    void joinVersion;

    const onlineSet = new Set(Array.isArray(onlineUids) ? onlineUids : []);
    const now = Date.now();

    if (lastKnownHostId && players.some((p) => p.id === lastKnownHostId)) {
      if (!presenceReady) {
        return lastKnownHostId;
      }
      if (onlineSet.has(lastKnownHostId)) {
        return lastKnownHostId;
      }
      if (lastKnownHostId === stableHostId && hostLikelyUnavailable) {
        // host missing beyond grace; fall through to selectHostCandidate
      } else {
        const lastPresence = presenceLastSeenRef.current.get(lastKnownHostId) ?? null;
        if (lastPresence !== null && now - lastPresence < graceMs) {
          return lastKnownHostId;
        }
      }
    }

    const inputs = players.map((player) => {
      const joinedAt = playerJoinOrderRef.current.get(player.id) ?? Number.MAX_SAFE_INTEGER;
      const lastPresence = presenceLastSeenRef.current.get(player.id) ?? null;
      const isOnline =
        !presenceReady || onlineSet.has(player.id) || (lastPresence !== null && now - lastPresence < graceMs);
      const lastSeenAt = lastPresence ?? null;
      return {
        id: player.id,
        joinedAt,
        orderIndex: typeof player.orderIndex === "number" ? player.orderIndex : null,
        lastSeenAt,
        isOnline,
        name: player.name ?? null,
      };
    });

    return selectHostCandidate(inputs) ?? null;
  }, [
    graceMs,
    hostLikelyUnavailable,
    joinVersion,
    lastKnownHostId,
    onlineUids,
    playerJoinOrderRef,
    players,
    presenceLastSeenRef,
    presenceReady,
    roomId,
    stableHostId,
  ]);
}

