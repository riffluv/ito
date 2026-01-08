"use client";

import { lockScroll } from "@/lib/ui/scrollLock";
import type { GameResultOverlayMode } from "@/components/ui/gameResultOverlaySupport";
import { useEffect } from "react";

export function useGameResultOverlayScrollLock(mode: GameResultOverlayMode) {
  useEffect(() => {
    if (mode !== "overlay" || typeof window === "undefined") {
      return undefined;
    }

    const releaseScroll = lockScroll({ lockRoot: true });

    return () => {
      releaseScroll();
    };
  }, [mode]);
}

