import { useEffect, useRef } from "react";

type SoundManagerLike = {
  markUserInteraction: () => void;
  prepareForInteraction: () => Promise<void>;
};

export function useAudioResumeOnPointer(params: {
  roomStatus?: string;
  soundManager: SoundManagerLike | null;
}) {
  const { roomStatus, soundManager } = params;

  const pointerUnlockArmedRef = useRef(false);
  const pointerUnlockDoneRef = useRef(false);

  useEffect(() => {
    const audioResumeEnabled =
      process.env.NEXT_PUBLIC_AUDIO_RESUME_ON_POINTER === "1";
    if (!audioResumeEnabled || typeof window === "undefined" || !soundManager) {
      return undefined;
    }

    if (roomStatus !== "clue") {
      pointerUnlockArmedRef.current = false;
      pointerUnlockDoneRef.current = false;
      return undefined;
    }
    if (pointerUnlockDoneRef.current || pointerUnlockArmedRef.current) {
      return undefined;
    }

    const handlePointer = () => {
      pointerUnlockDoneRef.current = true;
      pointerUnlockArmedRef.current = false;
      soundManager.markUserInteraction();
      void soundManager.prepareForInteraction();
    };

    pointerUnlockArmedRef.current = true;
    window.addEventListener("pointerdown", handlePointer, {
      passive: true,
      once: true,
    });

    return () => {
      if (pointerUnlockArmedRef.current && !pointerUnlockDoneRef.current) {
        window.removeEventListener("pointerdown", handlePointer);
        pointerUnlockArmedRef.current = false;
      }
    };
  }, [roomStatus, soundManager]);
}

