import { useCallback, useEffect, useRef } from "react";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { useSoundManager } from "@/lib/audio/SoundProvider";
import type { SoundId } from "@/lib/audio/types";
import { traceAction, traceError } from "@/lib/utils/trace";

export function useDropSounds(roomId: string): {
  playSuccessSound: () => void;
  playInvalidSound: () => void;
} {
  const playCardPlace = useSoundEffect("card_place");
  const playDropInvalid = useCallback(() => {}, []);
  const soundManager = useSoundManager();
  const prewarmRoomRef = useRef<string | null>(null);
  const dropSoundReady = useRef(false);

  useEffect(() => {
    if (!soundManager || !roomId) return;
    if (prewarmRoomRef.current === roomId && dropSoundReady.current) return;
    const targetRoom = roomId;
    prewarmRoomRef.current = targetRoom;
    const dropSoundIds: SoundId[] = ["card_place", "drop_success"];
    void soundManager
      .prewarm(dropSoundIds)
      .then(() => {
        if (prewarmRoomRef.current === targetRoom) {
          dropSoundReady.current = true;
        }
        traceAction("audio.prewarm.drop", { roomId: targetRoom });
      })
      .catch((error: unknown) => {
        if (prewarmRoomRef.current === targetRoom) {
          dropSoundReady.current = false;
        }
        traceError("audio.prewarm.drop.failed", error, { roomId: targetRoom });
      });
  }, [soundManager, roomId]);

  const ensureInteraction = useCallback(() => {
    if (!soundManager) return;
    soundManager.markUserInteraction();
    void soundManager.prepareForInteraction();
  }, [soundManager]);

  const playSuccessSound = useCallback(() => {
    ensureInteraction();
    playCardPlace();
  }, [ensureInteraction, playCardPlace]);

  const playInvalidSound = useCallback(() => {
    ensureInteraction();
    playDropInvalid();
  }, [ensureInteraction, playDropInvalid]);

  return { playSuccessSound, playInvalidSound };
}

