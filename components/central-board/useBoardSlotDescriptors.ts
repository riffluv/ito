import { useMemo } from "react";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { isGameActiveStatus } from "./boardDerivations";
import { useBoardSlots } from "@/components/hooks/useBoardSlots";

export function useBoardSlotDescriptors(params: {
  resolvedSlotCount: number;
  paddedBoardProposal: (string | null)[];
  pending: (string | null)[];
  playerReadyMap: Map<string, boolean>;
  optimisticReturningIds: string[];
  roomStatus: RoomDoc["status"];
  orderList: string[];
  canDropAtPosition: (index: number) => boolean;
  eligibleIds: string[];
  eligibleIdSet: ReadonlySet<string>;
  playerMap: Map<string, PlayerDoc & { id: string }>;
  activeId: string | null;
}): ReturnType<typeof useBoardSlots> {
  const {
    resolvedSlotCount,
    paddedBoardProposal,
    pending,
    playerReadyMap,
    optimisticReturningIds,
    roomStatus,
    orderList,
    canDropAtPosition,
    eligibleIds,
    eligibleIdSet,
    playerMap,
    activeId,
  } = params;

  const isGameActive = useMemo(() => isGameActiveStatus(roomStatus), [roomStatus]);

  return useBoardSlots({
    slotCountDragging: resolvedSlotCount,
    slotCountStatic: resolvedSlotCount,
    activeProposal: paddedBoardProposal,
    pending,
    playerReadyMap,
    optimisticReturningIds,
    isGameActive,
    roomStatus,
    orderList,
    canDropAtPosition,
    eligibleIds,
    eligibleIdSet,
    playerMap,
    activeId,
  });
}

