import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { DragEndEvent } from "@dnd-kit/core";

import { notify } from "@/components/ui/notify";
import type { RoomDoc } from "@/lib/types";
import { computeMagnetTransform, type MagnetConfig, type MagnetResult, type RectLike } from "@/lib/ui/dragMagnet";
import { logWarn } from "@/lib/utils/log";
import { traceAction } from "@/lib/utils/trace";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";

import { RETURN_DROP_ZONE_ID, createInitialMagnetState } from "./constants";
import { handleMoveToCardDropEffects, handleReturnDropEffects, handleSlotDropEffects } from "./boardDropEffects";
import { interpretBoardDrop } from "./boardDropInterpretation";
import { getActiveRectWithDelta } from "./dragRects";

type PendingStateUpdater = (updater: (prev: (string | null)[]) => (string | null)[]) => void;

export function useBoardDragEndHandler(params: {
  activeId: string | null;
  resolveMode: string | null | undefined;
  roomStatus: RoomDoc["status"];
  roomId: string;
  meId: string;
  boardProposal: (string | null)[];
  dragSessionStartRef: MutableRefObject<number | null>;
  pendingRef: MutableRefObject<(string | null)[]>;
  slotCountDragging: number;
  boardContainerRef: MutableRefObject<HTMLElement | null>;
  lastDragPositionRef: MutableRefObject<{ x: number; y: number } | null>;
  cursorSnapOffset: { x: number; y: number } | null;
  magnetConfigRef: MutableRefObject<MagnetConfig>;
  getProjectedMagnetState: () => MagnetResult;
  enqueueMagnetUpdate: (update: { state: MagnetResult; immediate?: boolean }) => void;
  updateDropAnimationTarget: (
    rect: RectLike | null,
    options?: { magnetSnap?: boolean }
  ) => void;
  clearActive: (options?: { delayMagnetReset?: boolean }) => void;
  cancelPendingDragMove: () => void;
  endDropSession: () => void;
  playDropInvalid: () => void;
  playCardPlace: () => void;
  returnCardToWaiting: (playerId: string) => Promise<boolean>;
  onOptimisticProposalChange?: (
    playerId: string,
    state: "placed" | "removed" | null,
    targetIndex?: number | null
  ) => void;
  updatePendingState: PendingStateUpdater;
  scheduleDropRollback: (playerId: string, snapshot: (string | null)[]) => void;
  clearDropRollbackTimer: (playerId?: string) => void;
  clearOptimisticProposal: () => void;
  setOptimisticReturningIds: Dispatch<SetStateAction<string[]>>;
  applyOptimisticReorder: (playerId: string, targetIndex: number) => void;
}) {
  const {
    activeId,
    resolveMode,
    roomStatus,
    roomId,
    meId,
    boardProposal,
    dragSessionStartRef,
    pendingRef,
    slotCountDragging,
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
  } = params;

  return useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      // NOTE:
      // DragStart → DragEnd が同一 tick で発生した場合、React の state 更新が間に合わず
      // `activeId` がまだ null のまま DragEnd を迎えることがある。
      // その場合でも drag セッションを確実に後片付けしないと、waitingPlayers から
      // activeId が除外されたままになり「カードが消えた」ように見える。
      const activePlayerId = activeId ?? String(active.id);
      traceAction("drag.end", {
        activeId: activePlayerId,
        overId: over ? String(over.id) : null,
      });
      bumpMetric("drag", "ends", 1);
      setMetric("drag", "lastEndAt", Date.now());
      setMetric("drag", "lastEndActiveId", activePlayerId);
      setMetric("drag", "lastEndOverId", over ? String(over.id) : null);
      cancelPendingDragMove();
      const activeRect = getActiveRectWithDelta(active, event.delta);
      if (activeRect) {
        lastDragPositionRef.current = {
          x: activeRect.left + activeRect.width / 2,
          y: activeRect.top + activeRect.height / 2,
        };
      }
      const overRect = over?.rect ?? null;
      let magnetResult = createInitialMagnetState();
      updateDropAnimationTarget(null);
      let dragOutcome: string = "unknown";
      let dragOutcomeReason: string | null = null;

      try {
        // `activeId` がまだ反映されていない（DragStart 直後に DragEnd が来た）ケースは、
        // 実質的に「キャンセル扱い」で後片付けだけ行う。
        if (!activeId) {
          dragOutcome = "cancel";
          dragOutcomeReason = "missing-activeId";
          return;
        }
        if (resolveMode !== "sort-submit" || roomStatus !== "clue") {
          dragOutcome = "ignore";
          dragOutcomeReason = "non-interactive-phase";
          return;
        }

        const overId = over ? String(over.id) : null;
        const boardRect = boardContainerRef.current?.getBoundingClientRect() ?? null;
        const decision = interpretBoardDrop({
          activePlayerId,
          meId,
          overId,
          isSameTarget: over ? active.id === over.id : false,
          boardProposal,
          pending: pendingRef.current,
          slotCountDragging,
          hasOverRect: Boolean(overRect),
          boardBounds: boardRect
            ? {
                left: boardRect.left,
                right: boardRect.right,
                bottom: boardRect.bottom,
              }
            : null,
          lastDragPosition: lastDragPositionRef.current,
          returnDropZoneId: RETURN_DROP_ZONE_ID,
        });

        dragOutcome = decision.kind;
        if (decision.kind === "invalid") {
          dragOutcomeReason = decision.reason;
        }

        if (decision.kind === "return") {
          handleReturnDropEffects({
            activePlayerId,
            allowed: decision.allowed,
            reason: decision.allowed ? undefined : decision.reason,
            onOptimisticProposalChange,
            returnCardToWaiting,
            playDropInvalid,
          });
          return;
        }

        if (decision.kind === "invalid" && decision.reason === "no-over") {
          playDropInvalid();
          notify({
            title: "この位置には置けません",
            type: "info",
            duration: 900,
          });
          return;
        }

        if (decision.kind === "ignore") {
          return;
        }

        if (decision.kind === "slot" && overRect) {
          if (
            process.env.NODE_ENV === "development" &&
            decision.clamped &&
            decision.originalSlotIndex !== decision.slotIndex
          ) {
            logWarn("central-card-board", "slot-index-clamped", {
              originalSlotIndex: decision.originalSlotIndex,
              slotIndex: decision.slotIndex,
              maxSlots: decision.maxSlots,
              slotCountDragging,
            });
          }

          const currentMagnetState = getProjectedMagnetState();
          updateDropAnimationTarget(overRect as RectLike, {
            magnetSnap: currentMagnetState.shouldSnap,
          });
          magnetResult = computeMagnetTransform(overRect, activeRect, {
            ...magnetConfigRef.current,
            projectedOffset: {
              dx: currentMagnetState.dx + (cursorSnapOffset?.x ?? 0),
              dy: currentMagnetState.dy + (cursorSnapOffset?.y ?? 0),
            },
          });

          handleSlotDropEffects({
            roomId,
            activePlayerId,
            slotIndex: decision.slotIndex,
            operation: decision.operation,
            onOptimisticProposalChange,
            updatePendingState,
            scheduleDropRollback,
            clearDropRollbackTimer,
            playCardPlace,
            playDropInvalid,
            clearOptimisticProposal,
            setOptimisticReturningIds,
            applyOptimisticReorder,
          });
          return;
        }

        if (decision.kind === "invalid" && decision.reason === "target-not-found") {
          playDropInvalid();
          return;
        }

        if (decision.kind === "move-to-card") {
          handleMoveToCardDropEffects({
            roomId,
            activePlayerId,
            targetIndex: decision.targetIndex,
            playCardPlace,
            playDropInvalid,
            clearOptimisticProposal,
            setOptimisticReturningIds,
            applyOptimisticReorder,
          });
          return;
        }

        return;
      } finally {
        if (typeof performance !== "undefined" && dragSessionStartRef.current !== null) {
          const durationMs = Math.max(0, performance.now() - dragSessionStartRef.current);
          setMetric("drag", "lastSessionMs", Math.round(durationMs));
        }
        dragSessionStartRef.current = null;
        setMetric("drag", "lastOutcome", dragOutcome);
        setMetric("drag", "lastOutcomeReason", dragOutcomeReason);
        enqueueMagnetUpdate({ state: magnetResult, immediate: true });
        clearActive({ delayMagnetReset: true });
        endDropSession();
      }
    },
    [
      activeId,
      applyOptimisticReorder,
      boardContainerRef,
      boardProposal,
      cancelPendingDragMove,
      clearActive,
      clearDropRollbackTimer,
      clearOptimisticProposal,
      cursorSnapOffset,
      dragSessionStartRef,
      enqueueMagnetUpdate,
      endDropSession,
      getProjectedMagnetState,
      lastDragPositionRef,
      magnetConfigRef,
      meId,
      onOptimisticProposalChange,
      pendingRef,
      playCardPlace,
      playDropInvalid,
      resolveMode,
      roomId,
      roomStatus,
      returnCardToWaiting,
      scheduleDropRollback,
      setOptimisticReturningIds,
      slotCountDragging,
      updateDropAnimationTarget,
      updatePendingState,
    ]
  );
}
