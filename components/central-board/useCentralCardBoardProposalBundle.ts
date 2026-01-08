"use client";

import type { ResolveMode } from "@/lib/game/resolveMode";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";

import { useBoardActiveProposal } from "./useBoardActiveProposal";
import { useBoardCardRenderer } from "./useBoardCardRenderer";
import { useBoardDropSessionSystem } from "./useBoardDropSessionSystem";
import { useBoardOptimisticReturning } from "./useBoardOptimisticReturning";
import { useBoardPlaceholderSlots } from "./useBoardPlaceholderSlots";
import { useBoardRevealState } from "./useBoardRevealState";
import { useOptimisticProposalState } from "./useOptimisticProposalState";
import { usePendingPruneEffects } from "./usePendingPruneEffects";
import { useProposalSyncTrace } from "./useProposalSyncTrace";

export function useCentralCardBoardProposalBundle(params: {
  roomId: string;
  roomStatus: RoomDoc["status"];
  resolveMode: ResolveMode | null;
  orderList: string[];
  orderListLength: number;
  orderListKey: string;
  proposalKey: string;
  serverProposal: (string | null)[] | undefined;
  eligibleIdSet: Set<string>;
  orderNumbers: Record<string, number | null | undefined>;
  slotCount: number | undefined;
  availableEligibleCount: number;
  playerMap: Map<string, PlayerDoc & { id: string }>;
  pending: (string | null)[];
  pendingRef: MutableRefObject<(string | null)[]>;
  setPending: Dispatch<SetStateAction<(string | null)[]>>;
  updatePendingState: (
    updater: (prev: (string | null)[]) => (string | null)[]
  ) => void;
  optimisticReturningIds: string[];
  setOptimisticReturningIds: Dispatch<SetStateAction<string[]>>;
  missingPlayerIds: string[];
  failed: boolean;
  startPending: boolean;
  presenceReady: boolean;
  prefersReducedMotion: boolean;
  onOptimisticProposalChange?: (
    playerId: string,
    state: "placed" | "removed" | null,
    targetIndex?: number | null
  ) => void;
  playCardPlace: () => void;
  playDropInvalid: () => void;
}): {
  revealAnimating: ReturnType<typeof useBoardRevealState>["revealAnimating"];
  revealIndex: ReturnType<typeof useBoardRevealState>["revealIndex"];
  realtimeResult: ReturnType<typeof useBoardRevealState>["realtimeResult"];
  finalizeScheduled: ReturnType<typeof useBoardRevealState>["finalizeScheduled"];
  resultIntroReadyAt: ReturnType<typeof useBoardRevealState>["resultIntroReadyAt"];
  resultOverlayAllowed: ReturnType<typeof useBoardRevealState>["resultOverlayAllowed"];
  returningTimeoutsRef: ReturnType<typeof useBoardOptimisticReturning>["returningTimeoutsRef"];
  returnCardToWaiting: ReturnType<typeof useBoardOptimisticReturning>["returnCardToWaiting"];
  renderCard: ReturnType<typeof useBoardCardRenderer>["renderCard"];
  activeProposal: (string | null)[];
  optimisticProposal: ReturnType<typeof useOptimisticProposalState>["optimisticProposal"];
  boardProposal: ReturnType<typeof useOptimisticProposalState>["boardProposal"];
  clearOptimisticProposal: ReturnType<
    typeof useOptimisticProposalState
  >["clearOptimisticProposal"];
  applyOptimisticReorder: ReturnType<
    typeof useOptimisticProposalState
  >["applyOptimisticReorder"];
  scheduleDropRollback: ReturnType<
    typeof useOptimisticProposalState
  >["scheduleDropRollback"];
  clearDropRollbackTimer: ReturnType<
    typeof useOptimisticProposalState
  >["clearDropRollbackTimer"];
  resolvedSlotCount: ReturnType<typeof useBoardDropSessionSystem>["resolvedSlotCount"];
  beginDropSession: ReturnType<typeof useBoardDropSessionSystem>["beginDropSession"];
  endDropSession: ReturnType<typeof useBoardDropSessionSystem>["endDropSession"];
  paddedBoardProposal: ReturnType<typeof useBoardDropSessionSystem>["paddedBoardProposal"];
  dropAnimation: ReturnType<typeof useBoardDropSessionSystem>["dropAnimation"];
  updateDropAnimationTarget: ReturnType<
    typeof useBoardDropSessionSystem
  >["updateDropAnimationTarget"];
  placeholderSlots: ReturnType<typeof useBoardPlaceholderSlots>;
} {
  const {
    roomId,
    roomStatus,
    resolveMode,
    orderList,
    orderListLength,
    orderListKey,
    proposalKey,
    serverProposal,
    eligibleIdSet,
    orderNumbers,
    slotCount,
    availableEligibleCount,
    playerMap,
    pending,
    pendingRef,
    setPending,
    updatePendingState,
    optimisticReturningIds,
    setOptimisticReturningIds,
    missingPlayerIds,
    failed,
    startPending,
    presenceReady,
    prefersReducedMotion,
    onOptimisticProposalChange,
    playCardPlace,
    playDropInvalid,
  } = params;

  const {
    revealAnimating,
    revealIndex,
    realtimeResult,
    finalizeScheduled,
    resultIntroReadyAt,
    resultOverlayAllowed,
  } = useBoardRevealState({
    roomId,
    roomStatus,
    resolveMode,
    orderListLength,
    orderList,
    orderNumbers,
    startPending,
  });

  const { returningTimeoutsRef, returnCardToWaiting } = useBoardOptimisticReturning(
    {
      roomId,
      roomStatus,
      proposal: serverProposal ?? null,
      proposalKey,
      optimisticReturningIds,
      setOptimisticReturningIds,
      updatePendingState,
      playCardPlace,
      playDropInvalid,
    }
  );

  usePendingPruneEffects({
    orderList,
    orderListKey,
    proposal: serverProposal,
    proposalKey,
    updatePendingState,
  });

  const { renderCard } = useBoardCardRenderer({
    roomStatus,
    orderList,
    playerMap,
    pending,
    proposal: serverProposal,
    resolveMode,
    revealIndex,
    revealAnimating,
    failed,
    realtimeResult,
  });

  const activeProposal = useBoardActiveProposal({
    status: roomStatus,
    orderList,
    proposal: serverProposal,
    eligibleIdSet,
    orderListKey,
    proposalKey,
  });

  const {
    optimisticProposal,
    boardProposal,
    clearOptimisticProposal,
    applyOptimisticReorder,
    scheduleDropRollback,
    clearDropRollbackTimer,
  } = useOptimisticProposalState({
    roomId,
    roomStatus,
    activeProposal,
    serverProposal,
    serverProposalKey: proposalKey,
    pending,
    pendingRef,
    setPending,
    updatePendingState,
    optimisticReturningIds,
    setOptimisticReturningIds,
    returningTimeoutsRef,
    presenceReady,
    prefersReducedMotion,
    onOptimisticProposalChange,
  });

  const {
    resolvedSlotCount,
    beginDropSession,
    endDropSession,
    paddedBoardProposal,
    dropAnimation,
    updateDropAnimationTarget,
  } = useBoardDropSessionSystem({
    slotCount,
    availableEligibleCount,
    boardProposal,
    prefersReducedMotion,
  });

  const placeholderSlots = useBoardPlaceholderSlots({
    boardProposal,
    missingPlayerIds,
    roomId,
  });

  useProposalSyncTrace({
    proposalKey,
    roomId,
    activeProposal,
    orderListLength,
  });

  return {
    revealAnimating,
    revealIndex,
    realtimeResult,
    finalizeScheduled,
    resultIntroReadyAt,
    resultOverlayAllowed,
    returningTimeoutsRef,
    returnCardToWaiting,
    renderCard,
    activeProposal,
    optimisticProposal,
    boardProposal,
    clearOptimisticProposal,
    applyOptimisticReorder,
    scheduleDropRollback,
    clearDropRollbackTimer,
    resolvedSlotCount,
    beginDropSession,
    endDropSession,
    paddedBoardProposal,
    dropAnimation,
    updateDropAnimationTarget,
    placeholderSlots,
  };
}
