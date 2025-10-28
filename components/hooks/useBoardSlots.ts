import { useMemo } from "react";
import type { PlayerDoc, RoomDoc } from "@/lib/types";

interface SlotDescriptorBase {
  idx: number;
  totalSlots: number;
  droppableId: string;
  cardId: string | null;
  showCard: boolean;
  ready: boolean;
  isOptimisticReturning: boolean;
}

export interface DragSlotDescriptor extends SlotDescriptorBase {
  proposalCardId: string | null;
  pendingCardId: string | null;
}

export interface StaticSlotDescriptor extends SlotDescriptorBase {
  allowDrop: boolean;
}

const EMPTY_PLAYER_ID_SET: ReadonlySet<string> = new Set<string>();

type UseBoardSlotsParams = {
  slotCountDragging: number;
  slotCountStatic: number;
  activeProposal: (string | null)[];
  pending: string[];
  playerReadyMap: Map<string, boolean>;
  optimisticReturningIds: string[];
  isGameActive: boolean;
  roomStatus: RoomDoc["status"];
  orderList?: string[];
  canDropAtPosition: (index: number) => boolean;
  eligibleIds?: string[];
  eligibleIdSet: ReadonlySet<string>;
  playerMap: Map<string, PlayerDoc & { id: string }>;
  activeId: string | null;
};

export function useBoardSlots({
  slotCountDragging,
  slotCountStatic,
  activeProposal,
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
}: UseBoardSlotsParams) {
  const optimisticReturningSet = useMemo(
    () => new Set(optimisticReturningIds),
    [optimisticReturningIds]
  );

  const dragSlots = useMemo<DragSlotDescriptor[]>(() => {
    return Array.from({ length: Math.max(0, slotCountDragging) }).map((_, idx) => {
      const proposalCardId = activeProposal[idx] ?? null;
      const pendingCardId = pending?.[idx] ?? null;
      const cardId = proposalCardId ?? pendingCardId ?? null;
      const ready = cardId ? playerReadyMap.get(cardId) ?? false : false;
      const isOptimistic = cardId != null && optimisticReturningSet.has(cardId);
      const showCard = !!cardId && ready && !isOptimistic;
      return {
        idx,
        totalSlots: slotCountDragging,
        droppableId: `slot-${idx}`,
        cardId,
        showCard,
        ready,
        isOptimisticReturning: isOptimistic,
        proposalCardId,
        pendingCardId,
      };
    });
  }, [slotCountDragging, activeProposal, pending, playerReadyMap, optimisticReturningSet]);

  const staticSlots = useMemo<StaticSlotDescriptor[]>(() => {
    return Array.from({ length: Math.max(0, slotCountStatic) }).map((_, idx) => {
      const proposalCardId = activeProposal[idx] ?? null;
      const orderCardId = orderList?.[idx] ?? null;
      const pendingCardId = pending?.[idx] ?? null;
      const cardId = proposalCardId ?? orderCardId ?? pendingCardId ?? null;
      const ready = cardId ? playerReadyMap.get(cardId) ?? false : false;
      const isOptimistic = cardId != null && optimisticReturningSet.has(cardId);
      const forceVisible = roomStatus === "reveal" || roomStatus === "finished";
      const showCard = !!cardId && !isOptimistic && isGameActive && (ready || forceVisible);
      return {
        idx,
        totalSlots: slotCountStatic,
        droppableId: `slot-${idx}`,
        cardId,
        showCard,
        ready,
        isOptimisticReturning: isOptimistic,
        allowDrop: canDropAtPosition(idx),
      };
    });
  }, [
    slotCountStatic,
    activeProposal,
    orderList,
    pending,
    playerReadyMap,
    optimisticReturningSet,
    isGameActive,
    roomStatus,
    canDropAtPosition,
  ]);

  const pendingLookup = useMemo<ReadonlySet<string>>(() => {
    if (!pending || pending.length === 0) {
      return EMPTY_PLAYER_ID_SET;
    }
    const filtered = pending.filter(
      (id): id is string => typeof id === "string" && id.length > 0
    );
    if (filtered.length === 0) {
      return EMPTY_PLAYER_ID_SET;
    }
    return new Set(filtered);
  }, [pending]);

  const placedLookup = useMemo<ReadonlySet<string>>(() => {
    if (!Array.isArray(activeProposal) || activeProposal.length === 0) {
      return EMPTY_PLAYER_ID_SET;
    }
    const result = new Set<string>();
    activeProposal.forEach((id) => {
      if (typeof id === "string" && id.length > 0 && eligibleIdSet.has(id)) {
        result.add(id);
      }
    });
    if (result.size === 0) {
      return EMPTY_PLAYER_ID_SET;
    }
    return result;
  }, [activeProposal, eligibleIdSet]);

  const waitingPlayers = useMemo(() => {
    if (!Array.isArray(eligibleIds) || eligibleIds.length === 0) {
      return [];
    }
    const result: (PlayerDoc & { id: string })[] = [];
    eligibleIds.forEach((id) => {
      const player = playerMap.get(id);
      if (!player) return;
      if (pendingLookup !== EMPTY_PLAYER_ID_SET && pendingLookup.has(player.id)) {
        return;
      }
      if (optimisticReturningSet.has(player.id)) {
        result.push(player);
        return;
      }
      if (placedLookup !== EMPTY_PLAYER_ID_SET && placedLookup.has(player.id)) {
        return;
      }
      if (player.id === activeId) {
        return;
      }
      result.push(player);
    });
    return result;
  }, [
    Array.isArray(eligibleIds) ? eligibleIds.join(",") : "_",
    playerMap,
    pendingLookup,
    placedLookup,
    optimisticReturningSet,
    activeId,
  ]);

  return {
    dragSlots,
    staticSlots,
    waitingPlayers,
  };
}
