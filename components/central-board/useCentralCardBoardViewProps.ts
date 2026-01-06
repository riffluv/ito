"use client";

import type { PlayerDoc, PlayerSnapshot, RoomDoc } from "@/lib/types";
import type { ResolveMode } from "@/lib/game/resolveMode";
import type { RoomMachineClientEvent } from "@/lib/state/roomMachine";

import type { CentralCardBoardViewProps } from "./CentralCardBoardView";
import { buildCentralCardBoardViewProps } from "./buildCentralCardBoardViewProps";
import { isBoardInteractive } from "./boardUiFlags";
import { useBoardA11yMessage } from "./useBoardA11yMessage";
import { useBoardActiveProposal } from "./useBoardActiveProposal";
import { useBoardCardRenderer } from "./useBoardCardRenderer";
import { useBoardDebugDumpBundle } from "./useBoardDebugDumpBundle";
import { useBoardDragHandlers } from "./useBoardDragHandlers";
import { useBoardDropSessionSystem } from "./useBoardDropSessionSystem";
import { useBoardOptimisticReturning } from "./useBoardOptimisticReturning";
import { useBoardPlaceholderSlots } from "./useBoardPlaceholderSlots";
import { useBoardPresenceBundle } from "./useBoardPresenceBundle";
import { useBoardRevealState } from "./useBoardRevealState";
import { useBoardRoomKeys } from "./useBoardRoomKeys";
import { useBoardSlotDescriptors } from "./useBoardSlotDescriptors";
import { useBoardSlotHoverHandlers } from "./useBoardSlotHoverHandlers";
import { useCentralCardBoardDropBundle } from "./useCentralCardBoardDropBundle";
import { useCentralCardBoardInteractionProfile } from "./useCentralCardBoardInteractionProfile";
import { useCentralCardBoardLocalUiState } from "./useCentralCardBoardLocalUiState";
import { useCentralCardBoardMagnetAndDragSystem } from "./useCentralCardBoardMagnetAndDragSystem";
import { useOptimisticProposalState } from "./useOptimisticProposalState";
import { usePendingPruneEffects } from "./usePendingPruneEffects";
import { useProposalSyncTrace } from "./useProposalSyncTrace";
import { useRevealDoneFallback } from "./useRevealDoneFallback";
import { useRevealStatus } from "./useRevealStatus";
import { useVictoryRaysPrefetch } from "./useVictoryRaysPrefetch";

export type CentralCardBoardViewPropsInput = {
  roomId: string;
  players: (PlayerDoc & { id: string })[];
  orderList: string[];
  meId: string;
  eligibleIds: string[];
  roomStatus: RoomDoc["status"];
  failed: boolean;
  proposal?: (string | null)[];
  resolveMode: ResolveMode | null;
  orderNumbers: Record<string, number | null | undefined>;
  orderSnapshots: Record<string, PlayerSnapshot> | null;
  displayMode: "full" | "minimal";
  slotCount?: number;
  revealedAt?: unknown;
  uiRevealPending: boolean;
  dealPlayers: string[] | null;
  currentStreak: number;
  onOptimisticProposalChange?: (
    playerId: string,
    state: "placed" | "removed" | null
  ) => void;
  sendRoomEvent?: (event: RoomMachineClientEvent) => void;
  presenceReady: boolean;
  interactionEnabled: boolean;
};

export function useCentralCardBoardViewProps(
  input: CentralCardBoardViewPropsInput
): CentralCardBoardViewProps {
  const {
    roomId,
    players,
    orderList,
    meId,
    eligibleIds,
    roomStatus,
    failed,
    proposal,
    resolveMode,
    orderNumbers,
    orderSnapshots,
    displayMode,
    slotCount,
    revealedAt,
    uiRevealPending,
    dealPlayers,
    currentStreak,
    onOptimisticProposalChange,
    sendRoomEvent,
    presenceReady,
    interactionEnabled,
  } = input;

  const { isRevealing, localRevealPending } = useRevealStatus(
    roomId,
    roomStatus,
    uiRevealPending ?? false
  );

  useVictoryRaysPrefetch();

  const {
    playerMap,
    missingPlayerIds,
    eligibleIdSet,
    me,
    hasNumber,
    mePlaced,
    availableEligibleCount,
    dealReadyForMe,
    dealGuardActive,
    playerReadyMap,
  } = useBoardPresenceBundle({
    players,
    orderList,
    proposal,
    orderSnapshots,
    eligibleIds,
    meId,
    roomStatus,
    dealPlayers,
  });

  const { orderListKey, proposalKey, orderListLength } = useBoardRoomKeys({
    orderList,
    proposal,
  });

  const {
    activeId,
    setActiveId,
    optimisticReturningIds,
    setOptimisticReturningIds,
    cursorSnapOffset,
    setCursorSnapOffset,
    prefersReducedMotion,
    showStreakBanner,
    hideStreakBanner,
  } = useCentralCardBoardLocalUiState({
    roomStatus,
    failed,
    currentStreak,
  });

  const { pointerProfile, dropDebugEnabled } =
    useCentralCardBoardInteractionProfile();

  const {
    magnetController,
    enqueueMagnetUpdate,
    resetMagnet,
    getProjectedMagnetState,
    magnetConfigRef,
    boardContainerRef,
    dragActivationStartRef,
    handleBoardRef,
    updateBoardBounds,
    lastDragPositionRef,
    sensors,
    setDragBoostEnabled,
    onDragMove: magnetAwareDragMove,
    cancelPendingDragMove,
  } = useCentralCardBoardMagnetAndDragSystem({
    resolveMode,
    roomStatus,
    pointerProfile,
    cursorSnapOffset,
    prefersReducedMotion,
  });

  const {
    pending,
    setPending,
    pendingRef,
    updatePendingState,
    isOver,
    setIsOver,
    canDrop,
    onDropAtPosition,
    canDropAtPosition,
    playDropInvalid,
    playCardPlace,
    playDragPickup,
  } = useCentralCardBoardDropBundle({
    roomId,
    meId,
    me,
    roomStatus,
    orderList,
    proposal,
    hasNumber,
    mePlaced,
    dealReady: dealReadyForMe,
    dealGuardActive,
    interactionEnabled,
  });

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
    startPending: uiRevealPending || localRevealPending,
  });

  const { returningTimeoutsRef, returnCardToWaiting } =
    useBoardOptimisticReturning({
      roomId,
      roomStatus,
      proposal: proposal ?? null,
      proposalKey,
      optimisticReturningIds,
      setOptimisticReturningIds,
      updatePendingState,
      playCardPlace,
      playDropInvalid,
    });

  usePendingPruneEffects({
    orderList,
    orderListKey,
    proposal,
    proposalKey,
    updatePendingState,
  });

  const { renderCard } = useBoardCardRenderer({
    roomStatus,
    orderList,
    playerMap,
    pending,
    proposal,
    resolveMode,
    revealIndex,
    revealAnimating,
    failed,
    realtimeResult,
  });

  const activeProposal = useBoardActiveProposal({
    status: roomStatus,
    orderList,
    proposal,
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
    serverProposal: proposal,
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

  const { dragSlots, staticSlots, waitingPlayers } = useBoardSlotDescriptors({
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
  });

  useBoardDebugDumpBundle({
    enabled: dropDebugEnabled,
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
  });

  const { onSlotEnter, onSlotLeave } = useBoardSlotHoverHandlers({
    isOver,
    setIsOver,
  });

  useRevealDoneFallback({
    roomId,
    roomStatus,
    resolveMode,
    orderListLength,
    finalizeScheduled,
    sendRoomEvent,
    resultIntroReadyAt,
  });

  const { onDragStart, onDragCancel, onDragEnd } = useBoardDragHandlers({
    beginDropSession,
    endDropSession,
    updateDropAnimationTarget,
    updateBoardBounds,
    dragActivationStartRef,
    activeId,
    setActiveId,
    setCursorSnapOffset,
    setDragBoostEnabled,
    playDragPickup,
    resetMagnet,
    getProjectedMagnetState,
    prefersReducedMotion,
    setIsOver,
    cancelPendingDragMove,
    resolveMode,
    roomStatus,
    roomId,
    meId,
    boardProposal,
    pendingRef,
    resolvedSlotCount,
    boardContainerRef,
    lastDragPositionRef,
    cursorSnapOffset,
    magnetConfigRef,
    enqueueMagnetUpdate,
    playDropInvalid,
    playCardPlace,
    returnCardToWaiting,
    onOptimisticProposalChange,
    updatePendingState,
    scheduleDropRollback,
    clearDropRollbackTimer,
    clearOptimisticProposal,
    setOptimisticReturningIds,
    applyOptimisticReorder,
  });

  const activeBoard = isBoardInteractive({
    interactionEnabled,
    resolveMode,
    roomStatus,
  });

  const a11yLiveMessage = useBoardA11yMessage({
    isRevealing,
    revealIndex,
    orderListLength,
    roomStatus,
    realtimeResult,
  });

  return buildCentralCardBoardViewProps({
    activeBoard,
    a11yLiveMessage,
    dragSlots,
    staticSlots,
    magnetController,
    prefersReducedMotion,
    activeId,
    isOver,
    canDrop,
    sensors,
    onDragStart,
    onDragMove: magnetAwareDragMove,
    onDragEnd,
    onDragCancel,
    dropAnimation,
    renderCard,
    boardProposal,
    waitingPlayers,
    meId,
    displayMode,
    roomStatus,
    handleBoardRef,
    isRevealing,
    cursorSnapOffset,
    onDropAtPosition,
    onSlotEnter,
    onSlotLeave,
    showResultOverlay: roomStatus === "finished" && resultOverlayAllowed,
    failed,
    revealedAt,
    currentStreak,
    showStreakBanner,
    hideStreakBanner,
  });
}
