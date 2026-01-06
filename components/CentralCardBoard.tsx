"use client";

import {
  InteractiveBoard,
  StaticBoard,
  boardCollisionDetection,
  usePlayerPresenceState,
  useRevealStatus,
} from "@/components/central-board";
import {
  isGameActiveStatus,
} from "@/components/central-board/boardDerivations";
import { useBoardActiveProposal } from "@/components/central-board/useBoardActiveProposal";
import { useBoardClearActive } from "@/components/central-board/useBoardClearActive";
import { useBoardDragEndHandler } from "@/components/central-board/useBoardDragEndHandler";
import { useBoardDragMoveHandler } from "@/components/central-board/useBoardDragMoveHandler";
import { useBoardDragSensors } from "@/components/central-board/useBoardDragSensors";
import { useBoardDropAnimation } from "@/components/central-board/useBoardDropAnimation";
import { useBoardBoundsTracker } from "@/components/central-board/useBoardBoundsTracker";
import { useBoardDragBoostState } from "@/components/central-board/useBoardDragBoostState";
import { useBoardReleaseMagnet } from "@/components/central-board/useBoardReleaseMagnet";
import { useBoardDebugDumpState } from "@/components/central-board/useBoardDebugDumpState";
import { useBoardDragCancelHandlers } from "@/components/central-board/useBoardDragCancelHandlers";
import { useBoardDragStartHandler } from "@/components/central-board/useBoardDragStartHandler";
import { useBoardCardRenderer } from "@/components/central-board/useBoardCardRenderer";
import { useBoardPlaceholderSlots } from "@/components/central-board/useBoardPlaceholderSlots";
import { useBoardPendingState } from "@/components/central-board/useBoardPendingState";
import { useBoardSlotHoverHandlers } from "@/components/central-board/useBoardSlotHoverHandlers";
import { useBoardSlotCountState } from "@/components/central-board/useBoardSlotCountState";
import { useBoardMagnetConfig } from "@/components/central-board/useBoardMagnetConfig";
import { useBoardRoomKeys } from "@/components/central-board/useBoardRoomKeys";
import { usePlayerReadyMap } from "@/components/central-board/usePlayerReadyMap";
import { useProposalSyncTrace } from "@/components/central-board/useProposalSyncTrace";
import { useResultOverlayAllowed } from "@/components/central-board/useResultOverlayAllowed";
import { useStreakBannerState } from "@/components/central-board/useStreakBannerState";
import { useVictoryRaysPrefetch } from "@/components/central-board/useVictoryRaysPrefetch";
import { useOptimisticProposalState } from "@/components/central-board/useOptimisticProposalState";
import { useOptimisticReturningIds } from "@/components/central-board/useOptimisticReturningIds";
import { usePendingPruneEffects } from "@/components/central-board/usePendingPruneEffects";
import { useRevealDoneFallback } from "@/components/central-board/useRevealDoneFallback";
import { useBoardSlots } from "@/components/hooks/useBoardSlots";
import { useDropHandler } from "@/components/hooks/useDropHandler";
import { useMagnetController } from "@/components/hooks/useMagnetController";
import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import useReducedMotionPreference from "@/hooks/useReducedMotionPreference";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import type { ResolveMode } from "@/lib/game/resolveMode";
import { useSupportToolsEnabled } from "@/lib/hooks/useSupportToolsEnabled";
import { usePointerProfile } from "@/lib/hooks/usePointerProfile";
import type { RoomMachineClientEvent } from "@/lib/state/roomMachine";
import type { PlayerDoc, PlayerSnapshot, RoomDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, VisuallyHidden } from "@chakra-ui/react";
import dynamic from "next/dynamic";
import React, {
  useMemo,
  useRef,
  useState,
} from "react";

const GameResultOverlay = dynamic(
  () =>
    import("@/components/ui/GameResultOverlay").then(
      (mod) => mod.GameResultOverlay
    ),
  { loading: () => null, ssr: false }
);

const StreakBanner = dynamic(
  () => import("@/components/ui/StreakBanner").then((mod) => mod.StreakBanner),
  { loading: () => null }
);

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
  } = usePlayerPresenceState({
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
    isOver,
    setIsOver,
    canDrop,
    onDropAtPosition,
    canDropAtPosition,
  } = useDropHandler({
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

  const { pendingRef, updatePendingState } = useBoardPendingState({
    pending,
    setPending,
  });

  const playerReadyMap = usePlayerReadyMap({ playerMap });

  const playDropInvalid = useSoundEffect(undefined);
  const playCardPlace = useSoundEffect("card_place");
  const playDragPickup = useSoundEffect(undefined);

  const {
    revealAnimating,
    revealIndex,
    realtimeResult,
    finalizeScheduled,
    resultIntroReadyAt,
  } = useRevealAnimation({
    roomId,
    roomStatus,
    resolveMode: resolveMode ?? undefined,
    orderListLength,
    orderData:
      orderList && orderNumbers
        ? {
            list: orderList,
            numbers: orderNumbers,
          }
        : null,
    startPending: uiRevealPending || localRevealPending,
  });

  const resultOverlayAllowed = useResultOverlayAllowed({
    roomStatus,
    resultIntroReadyAt,
  });

  // optimisticReturningIds のタイムアウトクリア用
  const returningTimeoutsRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());

  const { returnCardToWaiting } = useOptimisticReturningIds({
    roomId,
    roomStatus,
    proposal: proposal ?? null,
    proposalKey,
    optimisticReturningIds,
    setOptimisticReturningIds,
    returningTimeoutsRef,
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

  const isGameActive = useMemo(() => isGameActiveStatus(roomStatus), [roomStatus]);

  const { dragSlots, staticSlots, waitingPlayers } = useBoardSlots({
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

  useBoardDebugDumpState({
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

  const activeBoard =
    interactionEnabled && resolveMode === "sort-submit" && roomStatus === "clue";

  return (
    <Box
      data-board-root
      h="100%"
      display="flex"
      flexDirection="column"
      border="none"
      borderWidth="0"
      css={{
        background: "transparent",
        position: "relative",
        "@media (pointer: coarse)": {
          touchAction: "pan-y",
          WebkitTouchCallout: "none",
          userSelect: "none",
          overscrollBehavior: "contain",
        },
      }}
    >
      <VisuallyHidden aria-live="polite">
        {isRevealing
          ? `進行状況: ${revealIndex} / ${(orderList || []).length}`
          : roomStatus === "finished"
            ? realtimeResult?.failedAt !== null &&
              realtimeResult?.failedAt !== undefined
              ? `結果: ${realtimeResult.failedAt}番目で失敗`
              : "結果: 成功"
            : ""}
      </VisuallyHidden>

      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="flex-start"
        overflow="visible"
        position="relative"
        minHeight={0}
        pt={{ base: "8vh", md: "10vh" }}
        pb={{ base: 2, md: 3 }}
        css={{
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            paddingTop: "9vh !important",
            paddingBottom: "0.75rem !important",
          },
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
            paddingTop: "10vh !important",
            paddingBottom: "0.5rem !important",
          },
        }}
      >
        {activeBoard ? (
          <InteractiveBoard
            slots={dragSlots}
            magnetController={magnetController}
            prefersReducedMotion={prefersReducedMotion}
            activeId={activeId}
            isOver={isOver}
            canDrop={canDrop}
            sensors={sensors}
            collisionDetection={boardCollisionDetection}
            onDragStart={onDragStart}
            onDragMove={magnetAwareDragMove}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
            dropAnimation={dropAnimation}
            renderCard={renderCard}
            activeProposal={boardProposal}
            waitingPlayers={waitingPlayers}
            meId={meId}
            displayMode={displayMode}
            roomStatus={roomStatus}
            boardRef={handleBoardRef}
            isRevealing={isRevealing}
            cursorSnapOffset={cursorSnapOffset}
          />
        ) : (
          <StaticBoard
            slots={staticSlots}
            renderCard={renderCard}
            isOver={isOver}
            canDrop={canDrop}
            roomStatus={roomStatus}
            waitingPlayers={waitingPlayers}
            meId={meId}
            displayMode={displayMode}
            onDropAtPosition={onDropAtPosition}
            onSlotEnter={onSlotEnter}
            onSlotLeave={onSlotLeave}
            isRevealing={isRevealing}
          />
        )}
      </Box>
      {roomStatus === "finished" && resultOverlayAllowed && (
        <GameResultOverlay
          failed={failed}
          mode="overlay"
          revealedAt={revealedAt}
        />
      )}
      <StreakBanner
        streak={currentStreak}
        isVisible={showStreakBanner}
        onComplete={hideStreakBanner}
      />
    </Box>
  );
};

export default CentralCardBoard;
