"use client";

import type { RoomDoc } from "@/lib/types";
import type { PointerProfile } from "@/lib/hooks/usePointerProfile";

import { useBoardDragSystem } from "./useBoardDragSystem";
import { useBoardMagnetSystem } from "./useBoardMagnetSystem";

export function useCentralCardBoardMagnetAndDragSystem(params: {
  resolveMode: string | null | undefined;
  roomStatus: RoomDoc["status"];
  pointerProfile: PointerProfile;
  prefersReducedMotion: boolean;
  cursorSnapOffset: { x: number; y: number } | null;
}): ReturnType<typeof useBoardDragSystem> &
  Omit<ReturnType<typeof useBoardMagnetSystem>, "magnetConfigRef"> & {
    magnetConfigRef: ReturnType<typeof useBoardMagnetSystem>["magnetConfigRef"];
  } {
  const {
    resolveMode,
    roomStatus,
    pointerProfile,
    prefersReducedMotion,
    cursorSnapOffset,
  } = params;

  const {
    magnetController,
    enqueueMagnetUpdate,
    resetMagnet,
    scheduleMagnetTarget,
    getProjectedMagnetState,
    magnetConfigRef,
    releaseMagnet,
  } = useBoardMagnetSystem({
    pointerProfile,
    prefersReducedMotion,
  });

  const dragSystem = useBoardDragSystem({
    resolveMode,
    roomStatus,
    pointerProfile,
    magnetConfigRef,
    cursorSnapOffset,
    scheduleMagnetTarget,
    getProjectedMagnetState,
    enqueueMagnetUpdate,
    releaseMagnet,
  });

  return {
    ...dragSystem,
    magnetController,
    enqueueMagnetUpdate,
    resetMagnet,
    scheduleMagnetTarget,
    getProjectedMagnetState,
    magnetConfigRef,
    releaseMagnet,
  };
}

