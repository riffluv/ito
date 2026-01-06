"use client";

import type { PlayerDoc, PlayerSnapshot, RoomDoc } from "@/lib/types";

import { useBoardPresenceBundle } from "./useBoardPresenceBundle";
import { useBoardRoomKeys } from "./useBoardRoomKeys";
import { useRevealStatus } from "./useRevealStatus";
import { useVictoryRaysPrefetch } from "./useVictoryRaysPrefetch";

export function useCentralCardBoardPrelude(params: {
  roomId: string;
  roomStatus: RoomDoc["status"];
  uiRevealPending: boolean;
  players: (PlayerDoc & { id: string })[];
  orderList: string[];
  proposal: (string | null)[] | undefined;
  orderSnapshots: Record<string, PlayerSnapshot> | null;
  eligibleIds: string[];
  meId: string;
  dealPlayers: string[] | null;
}): ReturnType<typeof useRevealStatus> &
  ReturnType<typeof useBoardPresenceBundle> &
  ReturnType<typeof useBoardRoomKeys> {
  const {
    roomId,
    roomStatus,
    uiRevealPending,
    players,
    orderList,
    proposal,
    orderSnapshots,
    eligibleIds,
    meId,
    dealPlayers,
  } = params;

  const revealStatus = useRevealStatus(roomId, roomStatus, uiRevealPending);
  useVictoryRaysPrefetch();

  const presence = useBoardPresenceBundle({
    players,
    orderList,
    proposal,
    orderSnapshots,
    eligibleIds,
    meId,
    roomStatus,
    dealPlayers,
  });

  const keys = useBoardRoomKeys({ orderList, proposal });

  return { ...revealStatus, ...presence, ...keys };
}

