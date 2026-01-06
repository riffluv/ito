import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { MagnetConfig, MagnetResult, RectLike } from "@/lib/ui/dragMagnet";
import type { RoomDoc } from "@/lib/types";

import { useBoardClearActive } from "./useBoardClearActive";
import { useBoardDragCancelHandlers } from "./useBoardDragCancelHandlers";
import { useBoardDragEndHandler } from "./useBoardDragEndHandler";
import { useBoardDragStartHandler } from "./useBoardDragStartHandler";

type PendingStateUpdater = (updater: (prev: (string | null)[]) => (string | null)[]) => void;

export function useBoardDragHandlers(params: {
  // from drop session
  beginDropSession: () => void;
  endDropSession: () => void;
  updateDropAnimationTarget: (
    rect: RectLike | null,
    options?: { magnetSnap?: boolean }
  ) => void;

  // bounds + activation
  updateBoardBounds: () => void;
  dragActivationStartRef: MutableRefObject<number | null>;

  // active + cursor snap
  activeId: string | null;
  setActiveId: Dispatch<SetStateAction<string | null>>;
  setCursorSnapOffset: Dispatch<SetStateAction<{ x: number; y: number } | null>>;

  // drag boost + sounds
  setDragBoostEnabled: Dispatch<SetStateAction<boolean>>;
  playDragPickup: () => void;

  // clearActive deps
  resetMagnet: (options?: { immediate?: boolean }) => void;
  getProjectedMagnetState: () => MagnetResult;
  prefersReducedMotion: boolean;
  setIsOver: Dispatch<SetStateAction<boolean>>;

  // cancel pending drag move
  cancelPendingDragMove: () => void;

  // drag end deps
  resolveMode: string | null | undefined;
  roomStatus: RoomDoc["status"];
  roomId: string;
  meId: string;
  boardProposal: (string | null)[];
  pendingRef: MutableRefObject<(string | null)[]>;
  resolvedSlotCount: number;
  boardContainerRef: MutableRefObject<HTMLDivElement | null>;
  lastDragPositionRef: MutableRefObject<{ x: number; y: number } | null>;
  cursorSnapOffset: { x: number; y: number } | null;
  magnetConfigRef: MutableRefObject<MagnetConfig>;
  enqueueMagnetUpdate: (update: { state: MagnetResult; immediate?: boolean }) => void;
  playDropInvalid: () => void;
  playCardPlace: () => void;
  returnCardToWaiting: (playerId: string) => Promise<boolean>;
  onOptimisticProposalChange?: (playerId: string, state: "placed" | "removed" | null) => void;
  updatePendingState: PendingStateUpdater;
  scheduleDropRollback: (playerId: string, snapshot: (string | null)[]) => void;
  clearDropRollbackTimer: (playerId?: string) => void;
  clearOptimisticProposal: () => void;
  setOptimisticReturningIds: Dispatch<SetStateAction<string[]>>;
  applyOptimisticReorder: (playerId: string, targetIndex: number) => void;
}): {
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
} {
  const {
    resetMagnet,
    getProjectedMagnetState,
    prefersReducedMotion,
    setIsOver,
    setActiveId,
    setCursorSnapOffset,
  } = params;

  const { clearActive } = useBoardClearActive({
    resetMagnet,
    getProjectedMagnetState,
    prefersReducedMotion,
    setIsOver,
    setActiveId,
    setCursorSnapOffset,
  });

  const onDragStart = useBoardDragStartHandler({
    beginDropSession: params.beginDropSession,
    updateBoardBounds: params.updateBoardBounds,
    updateDropAnimationTarget: params.updateDropAnimationTarget,
    resetMagnet: params.resetMagnet,
    dragActivationStartRef: params.dragActivationStartRef,
    setActiveId: params.setActiveId,
    setDragBoostEnabled: params.setDragBoostEnabled,
    playDragPickup: params.playDragPickup,
    setCursorSnapOffset: params.setCursorSnapOffset,
  });

  const { onDragCancel } = useBoardDragCancelHandlers({
    activeId: params.activeId,
    dragActivationStartRef: params.dragActivationStartRef,
    updateDropAnimationTarget: params.updateDropAnimationTarget,
    cancelPendingDragMove: params.cancelPendingDragMove,
    clearActive,
    endDropSession: params.endDropSession,
  });

  const onDragEnd = useBoardDragEndHandler({
    activeId: params.activeId,
    resolveMode: params.resolveMode,
    roomStatus: params.roomStatus,
    roomId: params.roomId,
    meId: params.meId,
    boardProposal: params.boardProposal,
    pendingRef: params.pendingRef,
    slotCountDragging: params.resolvedSlotCount,
    boardContainerRef: params.boardContainerRef,
    lastDragPositionRef: params.lastDragPositionRef,
    cursorSnapOffset: params.cursorSnapOffset,
    magnetConfigRef: params.magnetConfigRef,
    getProjectedMagnetState: params.getProjectedMagnetState,
    enqueueMagnetUpdate: params.enqueueMagnetUpdate,
    updateDropAnimationTarget: params.updateDropAnimationTarget,
    clearActive,
    cancelPendingDragMove: params.cancelPendingDragMove,
    endDropSession: params.endDropSession,
    playDropInvalid: params.playDropInvalid,
    playCardPlace: params.playCardPlace,
    returnCardToWaiting: params.returnCardToWaiting,
    onOptimisticProposalChange: params.onOptimisticProposalChange,
    updatePendingState: params.updatePendingState,
    scheduleDropRollback: params.scheduleDropRollback,
    clearDropRollbackTimer: params.clearDropRollbackTimer,
    clearOptimisticProposal: params.clearOptimisticProposal,
    setOptimisticReturningIds: params.setOptimisticReturningIds,
    applyOptimisticReorder: params.applyOptimisticReorder,
  });

  return { onDragStart, onDragEnd, onDragCancel };
}
