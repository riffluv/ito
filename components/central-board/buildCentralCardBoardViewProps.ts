import type { CentralCardBoardViewProps } from "./CentralCardBoardView";
import type { DragSlotDescriptor, StaticSlotDescriptor } from "@/components/hooks/useBoardSlots";
import type { MagnetController } from "@/components/hooks/useMagnetController";
import type { RoomDoc, PlayerDoc } from "@/lib/types";
import type { DragEvent, ReactNode, Ref } from "react";
import type {
  DndContextProps,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  DropAnimation,
} from "@dnd-kit/core";

type CursorSnapOffset = {
  x: number;
  y: number;
} | null;

export function buildCentralCardBoardViewProps(params: {
  activeBoard: boolean;
  a11yLiveMessage: string;
  dragSlots: DragSlotDescriptor[];
  staticSlots: StaticSlotDescriptor[];
  magnetController: MagnetController;
  prefersReducedMotion: boolean;
  activeId: string | null;
  isOver: boolean;
  canDrop: boolean;
  sensors: DndContextProps["sensors"];
  onDragStart: (event: DragStartEvent) => void;
  onDragMove: (event: DragMoveEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  dropAnimation: DropAnimation;
  renderCard: (id: string, idx?: number) => ReactNode;
  boardProposal: (string | null)[];
  waitingPlayers: (PlayerDoc & { id: string })[];
  meId: string;
  displayMode?: "full" | "minimal";
  roomStatus: RoomDoc["status"];
  handleBoardRef: Ref<HTMLDivElement>;
  isRevealing: boolean;
  cursorSnapOffset: CursorSnapOffset;
  onDropAtPosition: (event: DragEvent, index: number) => void;
  onSlotEnter: (index: number) => void;
  onSlotLeave: () => void;
  showResultOverlay: boolean;
  failed: boolean;
  revealedAt: unknown;
  currentStreak: number;
  showStreakBanner: boolean;
  hideStreakBanner: () => void;
}): CentralCardBoardViewProps {
  const {
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
    onDragMove,
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
    showResultOverlay,
    failed,
    revealedAt,
    currentStreak,
    showStreakBanner,
    hideStreakBanner,
  } = params;

  return {
    activeBoard,
    a11yLiveMessage,
    interactive: {
      slots: dragSlots,
      magnetController,
      prefersReducedMotion,
      activeId,
      isOver,
      canDrop,
      sensors,
      onDragStart,
      onDragMove,
      onDragEnd,
      onDragCancel,
      dropAnimation,
      renderCard,
      activeProposal: boardProposal,
      waitingPlayers,
      meId,
      displayMode,
      roomStatus,
      boardRef: handleBoardRef,
      isRevealing,
      cursorSnapOffset,
    },
    static: {
      slots: staticSlots,
      renderCard: (id: string, idx: number) => renderCard(id, idx),
      isOver,
      canDrop,
      roomStatus,
      waitingPlayers,
      meId,
      displayMode,
      onDropAtPosition,
      onSlotEnter,
      onSlotLeave,
      isRevealing,
    },
    showResultOverlay,
    failed,
    revealedAt,
    streak: {
      currentStreak,
      isVisible: showStreakBanner,
      onComplete: hideStreakBanner,
    },
  };
}
