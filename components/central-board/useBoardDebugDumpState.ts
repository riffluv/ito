import { useCallback } from "react";
import type { PlayerDoc, RoomDoc } from "@/lib/types";

import { useBoardDebugDump } from "./useBoardDebugDump";

export function useBoardDebugDumpState(params: {
  enabled: boolean;
  roomId: string;
  activeProposal: (string | null)[];
  boardProposal: (string | null)[];
  optimisticProposal: (string | null)[] | null;
  pending: (string | null)[];
  placeholderSlots: { slot: number; cardId: string }[];
  waitingPlayers: (PlayerDoc & { id: string })[];
  eligibleIds: string[];
  missingPlayerIds: string[];
  roomStatus: RoomDoc["status"];
}): void {
  const {
    enabled,
    roomId,
    activeProposal,
    boardProposal,
    optimisticProposal,
    pending,
    placeholderSlots,
    waitingPlayers,
    eligibleIds,
    missingPlayerIds,
    roomStatus,
  } = params;

  const dumpBoardState = useCallback(() => {
    return {
      roomId,
      timestamp: Date.now(),
      proposal: activeProposal,
      renderedProposal: boardProposal,
      optimisticProposal,
      pending,
      placeholders: placeholderSlots,
      waiting: waitingPlayers.map((player) => ({
        id: player.id,
        name: player.name,
      })),
      eligibleIds,
      missingPlayerIds,
      roomStatus,
    };
  }, [
    roomId,
    activeProposal,
    boardProposal,
    optimisticProposal,
    pending,
    placeholderSlots,
    waitingPlayers,
    eligibleIds,
    missingPlayerIds,
    roomStatus,
  ]);

  useBoardDebugDump({ enabled, dump: dumpBoardState });
}

