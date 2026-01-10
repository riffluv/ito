import { useRef, type MutableRefObject } from "react";
import type { RoomDoc } from "@/lib/types";
import type { PointerProfile } from "@/lib/hooks/usePointerProfile";
import type { MagnetConfig, MagnetResult } from "@/lib/ui/dragMagnet";

import { useBoardBoundsTracker } from "./useBoardBoundsTracker";
import { useBoardDragBoostState } from "./useBoardDragBoostState";
import { useBoardDragMoveHandler } from "./useBoardDragMoveHandler";
import { useBoardDragSensors } from "./useBoardDragSensors";

export function useBoardDragSystem(params: {
  resolveMode: string | null | undefined;
  roomStatus: RoomDoc["status"];
  pointerProfile: PointerProfile;
  magnetConfigRef: MutableRefObject<MagnetConfig>;
  cursorSnapOffset: { x: number; y: number } | null;
  scheduleMagnetTarget: (nextId: string | null) => void;
  getProjectedMagnetState: () => MagnetResult;
  enqueueMagnetUpdate: (update: { state: MagnetResult }) => void;
  releaseMagnet: () => void;
}): {
  boardContainerRef: MutableRefObject<HTMLDivElement | null>;
  boardBoundsRef: MutableRefObject<DOMRect | null>;
  dragActivationStartRef: MutableRefObject<number | null>;
  dragSessionStartRef: MutableRefObject<number | null>;
  handleBoardRef: (node: HTMLDivElement | null) => void;
  updateBoardBounds: () => void;
  lastDragPositionRef: MutableRefObject<{ x: number; y: number } | null>;
  sensors: ReturnType<typeof useBoardDragSensors>["sensors"];
  setDragBoostEnabled: ReturnType<typeof useBoardDragBoostState>["setDragBoostEnabled"];
  onDragMove: ReturnType<typeof useBoardDragMoveHandler>["onDragMove"];
  cancelPendingDragMove: ReturnType<typeof useBoardDragMoveHandler>["cancelPendingDragMove"];
} {
  const {
    resolveMode,
    roomStatus,
    pointerProfile,
    magnetConfigRef,
    cursorSnapOffset,
    scheduleMagnetTarget,
    getProjectedMagnetState,
    enqueueMagnetUpdate,
    releaseMagnet,
  } = params;

  const {
    boardContainerRef,
    boardBoundsRef,
    dragActivationStartRef,
    handleBoardRef,
    updateBoardBounds,
  } = useBoardBoundsTracker();

  const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const dragSessionStartRef = useRef<number | null>(null);

  const { dragBoostEnabled, setDragBoostEnabled } = useBoardDragBoostState({
    roomStatus,
    dragActivationStartRef,
  });

  const { sensors } = useBoardDragSensors({ pointerProfile, dragBoostEnabled });

  const { onDragMove, cancelPendingDragMove } = useBoardDragMoveHandler({
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

  return {
    boardContainerRef,
    boardBoundsRef,
    dragActivationStartRef,
    dragSessionStartRef,
    handleBoardRef,
    updateBoardBounds,
    lastDragPositionRef,
    sensors,
    setDragBoostEnabled,
    onDragMove,
    cancelPendingDragMove,
  };
}
