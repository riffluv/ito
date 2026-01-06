import { usePlayerPresenceState } from "@/components/central-board/usePlayerPresenceState";
import { usePlayerReadyMap } from "@/components/central-board/usePlayerReadyMap";
import type { PlayerDoc, PlayerSnapshot, RoomDoc } from "@/lib/types";

export function useBoardPresenceBundle(params: {
  players: (PlayerDoc & { id: string })[];
  orderList: (string | null)[];
  proposal?: (string | null)[];
  orderSnapshots?: Record<string, PlayerSnapshot> | null;
  eligibleIds?: string[];
  meId: string;
  roomStatus: RoomDoc["status"];
  dealPlayers?: string[] | null;
}): ReturnType<typeof usePlayerPresenceState> & {
  playerReadyMap: Map<string, boolean>;
} {
  const presence = usePlayerPresenceState(params);
  const playerReadyMap = usePlayerReadyMap({ playerMap: presence.playerMap });
  return { ...presence, playerReadyMap };
}

