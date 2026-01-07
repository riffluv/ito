import type { PlayerDoc } from "@/lib/types";
import { useMemo } from "react";

type RoomPlayer = PlayerDoc & { id: string };

type UseHostClaimDerivationsParams = {
  uid: string | null;
  isMember: boolean;
  players: RoomPlayer[];
  lastKnownHostId: string | null;
  presenceReady: boolean;
  onlineUids: string[] | null | undefined;
};

export function useHostClaimDerivations(params: UseHostClaimDerivationsParams) {
  const { uid, isMember, players, lastKnownHostId, presenceReady, onlineUids } = params;

  const isSoloMember = useMemo(
    () => isMember && players.length === 1 && players[0]?.id === (uid ?? ""),
    [isMember, players, uid]
  );

  const previousHostStillMember = useMemo(() => {
    if (!lastKnownHostId) return false;
    if (uid && lastKnownHostId === uid) return false;
    const hostPlayerExists = players.some((player) => player.id === lastKnownHostId);
    if (!hostPlayerExists) return false;
    if (!presenceReady) return true;
    return Array.isArray(onlineUids) && onlineUids.includes(lastKnownHostId);
  }, [lastKnownHostId, players, onlineUids, uid, presenceReady]);

  return { isSoloMember, previousHostStillMember } as const;
}

