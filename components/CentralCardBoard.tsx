"use client";

import { useRevealStatus } from "@/components/central-board";
import { useBoardActiveProposal } from "@/components/central-board/useBoardActiveProposal";
import { isBoardInteractive } from "@/components/central-board/boardUiFlags";
import { useBoardA11yMessage } from "@/components/central-board/useBoardA11yMessage";
import { useBoardClearActive } from "@/components/central-board/useBoardClearActive";
import { useBoardDragEndHandler } from "@/components/central-board/useBoardDragEndHandler";
import { useBoardDragMoveHandler } from "@/components/central-board/useBoardDragMoveHandler";
import { useBoardDragSensors } from "@/components/central-board/useBoardDragSensors";
import { useBoardDropAnimation } from "@/components/central-board/useBoardDropAnimation";
import { useBoardBoundsTracker } from "@/components/central-board/useBoardBoundsTracker";
import { useBoardDragBoostState } from "@/components/central-board/useBoardDragBoostState";
import { useBoardReleaseMagnet } from "@/components/central-board/useBoardReleaseMagnet";
import { useBoardDebugDumpBundle } from "@/components/central-board/useBoardDebugDumpBundle";
import { useBoardDragCancelHandlers } from "@/components/central-board/useBoardDragCancelHandlers";
import { useBoardDragStartHandler } from "@/components/central-board/useBoardDragStartHandler";
import { useBoardCardRenderer } from "@/components/central-board/useBoardCardRenderer";
import { useBoardPlaceholderSlots } from "@/components/central-board/useBoardPlaceholderSlots";
import { useBoardDropState } from "@/components/central-board/useBoardDropState";
import { useBoardSlotHoverHandlers } from "@/components/central-board/useBoardSlotHoverHandlers";
import { useBoardSlotCountState } from "@/components/central-board/useBoardSlotCountState";
import { useBoardMagnetConfig } from "@/components/central-board/useBoardMagnetConfig";
import { useBoardOptimisticReturning } from "@/components/central-board/useBoardOptimisticReturning";
import { useBoardRoomKeys } from "@/components/central-board/useBoardRoomKeys";
import { useBoardRevealState } from "@/components/central-board/useBoardRevealState";
import { useBoardPresenceBundle } from "@/components/central-board/useBoardPresenceBundle";
import { useProposalSyncTrace } from "@/components/central-board/useProposalSyncTrace";
import { useBoardSlotDescriptors } from "@/components/central-board/useBoardSlotDescriptors";
import { useStreakBannerState } from "@/components/central-board/useStreakBannerState";
import { useVictoryRaysPrefetch } from "@/components/central-board/useVictoryRaysPrefetch";
import { useOptimisticProposalState } from "@/components/central-board/useOptimisticProposalState";
import { usePendingPruneEffects } from "@/components/central-board/usePendingPruneEffects";
import { useRevealDoneFallback } from "@/components/central-board/useRevealDoneFallback";
import { useMagnetController } from "@/components/hooks/useMagnetController";
import useReducedMotionPreference from "@/hooks/useReducedMotionPreference";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import type { ResolveMode } from "@/lib/game/resolveMode";
import { useSupportToolsEnabled } from "@/lib/hooks/useSupportToolsEnabled";
import { usePointerProfile } from "@/lib/hooks/usePointerProfile";
import type { RoomMachineClientEvent } from "@/lib/state/roomMachine";
import type { PlayerDoc, PlayerSnapshot, RoomDoc } from "@/lib/types";
import { CentralCardBoardView } from "@/components/central-board/CentralCardBoardView";
import { buildCentralCardBoardViewProps } from "@/components/central-board/buildCentralCardBoardViewProps";
import React, {
  useRef,
  useState,
} from "react";

interface CentralCardBoardProps {
  roomId: string;
  players: (PlayerDoc & { id: string })[];
  orderList: string[];
  meId: string;
  eligibleIds: string[];
  roomStatus: RoomDoc["status"];
  cluesReady?: boolean;
  failed: boolean;
  proposal?: (string | null)[];
  resolveMode?: ResolveMode | null;
  orderNumbers?: Record<string, number | null | undefined>;
  orderSnapshots?: Record<string, PlayerSnapshot> | null;
  displayMode?: "full" | "minimal";
  slotCount?: number;
  topic?: string | null;
  revealedAt?: unknown;
  uiRevealPending?: boolean;
  dealPlayers?: string[] | null;
  currentStreak?: number;
  onOptimisticProposalChange?: (
    playerId: string,
    state: "placed" | "removed" | null
  ) => void;
  sendRoomEvent?: (event: RoomMachineClientEvent) => void;
  presenceReady?: boolean;
  interactionEnabled?: boolean;
}

const CentralCardBoard: React.FC<CentralCardBoardProps> = ({
  roomId,
  players,
  orderList,
  meId,
  eligibleIds,
  roomStatus,
  failed,
  proposal,
  resolveMode = "sort-submit",
  orderNumbers = {},
  orderSnapshots = null,
  displayMode = "full",
  slotCount,
  revealedAt,
  uiRevealPending = false,
  dealPlayers = null,
  currentStreak = 0,
  onOptimisticProposalChange,
  sendRoomEvent,
  presenceReady = true,
  interactionEnabled = true,
}) => {
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

  const [activeId, setActiveId] = useState<string | null>(null);
  const [optimisticReturningIds, setOptimisticReturningIds] = useState<
    string[]
  >([]);
  const prefersReducedMotion = useReducedMotionPreference();
  const { showStreakBanner, hideStreakBanner } = useStreakBannerState({
    roomStatus,
    failed,
    currentStreak,
    prefersReducedMotion,
  });

  const pointerProfile = usePointerProfile();
  const supportToolsEnabled = useSupportToolsEnabled();
  const dropDebugEnabled =
    process.env.NEXT_PUBLIC_UI_DROP_DEBUG === "1" || supportToolsEnabled;

  const [cursorSnapOffset, setCursorSnapOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const magnetConfig = useBoardMagnetConfig({
    pointerProfile,
    prefersReducedMotion,
  });
  const magnetController = useMagnetController(magnetConfig, {
    prefersReducedMotion,
  });
  const {
    enqueueMagnetUpdate,
    resetMagnet,
    scheduleMagnetTarget,
    getProjectedMagnetState,
    magnetConfigRef,
  } = magnetController;

  const { dropAnimation, updateDropAnimationTarget } = useBoardDropAnimation({
    prefersReducedMotion,
  });

  const { releaseMagnet } = useBoardReleaseMagnet({
    scheduleMagnetTarget,
    getProjectedMagnetState,
    enqueueMagnetUpdate,
  });

  const {
    boardContainerRef,
    boardBoundsRef,
    dragActivationStartRef,
    handleBoardRef,
    updateBoardBounds,
  } = useBoardBoundsTracker();
  const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const { dragBoostEnabled, setDragBoostEnabled } = useBoardDragBoostState({
    roomStatus,
    dragActivationStartRef,
  });

  const { sensors } = useBoardDragSensors({ pointerProfile, dragBoostEnabled });

  const { onDragMove: magnetAwareDragMove, cancelPendingDragMove } =
    useBoardDragMoveHandler({
      resolveMode,
      roomStatus,
      boardBoundsRef,
      lastDragPositionRef,
      magnetConfigRef,
      cursorSnapOffset,
      scheduleMagnetTarget,
      getProjectedMagnetState,
      enqueueMagnetUpdate,
      releaseMagnet,
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
  } = useBoardDropState({
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

  const playDropInvalid = useSoundEffect(undefined);
  const playCardPlace = useSoundEffect("card_place");
  const playDragPickup = useSoundEffect(undefined);

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

  const { returningTimeoutsRef, returnCardToWaiting } = useBoardOptimisticReturning({
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

  const { resolvedSlotCount, beginDropSession, endDropSession, paddedBoardProposal } =
    useBoardSlotCountState({
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

  const onDragStart = useBoardDragStartHandler({
    beginDropSession,
    updateBoardBounds,
    updateDropAnimationTarget,
    resetMagnet,
    dragActivationStartRef,
    setActiveId,
    setDragBoostEnabled,
    playDragPickup,
    setCursorSnapOffset,
  });

  const { clearActive } = useBoardClearActive({
    resetMagnet,
    getProjectedMagnetState,
    prefersReducedMotion,
    setIsOver,
    setActiveId,
    setCursorSnapOffset,
  });

  const { onDragCancel } = useBoardDragCancelHandlers({
    activeId,
    dragActivationStartRef,
    updateDropAnimationTarget,
    cancelPendingDragMove,
    clearActive,
    endDropSession,
  });

  const onDragEnd = useBoardDragEndHandler({
    activeId,
    resolveMode,
    roomStatus,
    roomId,
    meId,
    boardProposal,
    pendingRef,
    slotCountDragging: resolvedSlotCount,
    boardContainerRef,
    lastDragPositionRef,
    cursorSnapOffset,
    magnetConfigRef,
    getProjectedMagnetState,
    enqueueMagnetUpdate,
    updateDropAnimationTarget,
    clearActive,
    cancelPendingDragMove,
    endDropSession,
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

  const viewProps = buildCentralCardBoardViewProps({
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

  return (
    <CentralCardBoardView {...viewProps} />
  );
};

export default CentralCardBoard;
