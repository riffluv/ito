"use client";
import { useCallback } from "react";
import { PlaybackOverrides, SoundId } from "./types";
import { useSoundManager } from "./SoundProvider";

export const useSoundEffect = (
  soundId: SoundId | undefined,
  defaultOverrides?: PlaybackOverrides
) => {
  const manager = useSoundManager();
  return useCallback(
    (overrides?: PlaybackOverrides) => {
      if (!manager || !soundId) return;
      const merged = overrides
        ? { ...defaultOverrides, ...overrides }
        : defaultOverrides;
      void manager.play(soundId, merged);
    },
    [manager, soundId, defaultOverrides]
  );
};
