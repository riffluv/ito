"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { RoomDoc } from "@/lib/types";
import useReducedMotionPreference from "@/hooks/useReducedMotionPreference";

import { useStreakBannerState } from "./useStreakBannerState";

export function useCentralCardBoardLocalUiState(params: {
  roomStatus: RoomDoc["status"];
  failed: boolean;
  currentStreak: number;
}): {
  activeId: string | null;
  setActiveId: Dispatch<SetStateAction<string | null>>;
  optimisticReturningIds: string[];
  setOptimisticReturningIds: Dispatch<SetStateAction<string[]>>;
  cursorSnapOffset: { x: number; y: number } | null;
  setCursorSnapOffset: Dispatch<
    SetStateAction<{ x: number; y: number } | null>
  >;
  prefersReducedMotion: boolean;
  showStreakBanner: ReturnType<typeof useStreakBannerState>["showStreakBanner"];
  hideStreakBanner: ReturnType<typeof useStreakBannerState>["hideStreakBanner"];
} {
  const { roomStatus, failed, currentStreak } = params;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [optimisticReturningIds, setOptimisticReturningIds] = useState<string[]>(
    []
  );
  const [cursorSnapOffset, setCursorSnapOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const prefersReducedMotion = useReducedMotionPreference();
  const { showStreakBanner, hideStreakBanner } = useStreakBannerState({
    roomStatus,
    failed,
    currentStreak,
    prefersReducedMotion,
  });

  return {
    activeId,
    setActiveId,
    optimisticReturningIds,
    setOptimisticReturningIds,
    cursorSnapOffset,
    setCursorSnapOffset,
    prefersReducedMotion,
    showStreakBanner,
    hideStreakBanner,
  };
}
