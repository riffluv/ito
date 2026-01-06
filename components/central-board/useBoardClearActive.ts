import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import { unstable_batchedUpdates } from "react-dom";

type MagnetStateLike = {
  shouldSnap: boolean;
};

type ResetMagnet = (options?: { immediate?: boolean }) => void;
type GetProjectedMagnetState = () => MagnetStateLike;

export function useBoardClearActive(params: {
  resetMagnet: ResetMagnet;
  getProjectedMagnetState: GetProjectedMagnetState;
  prefersReducedMotion: boolean;
  setIsOver: Dispatch<SetStateAction<boolean>>;
  setActiveId: Dispatch<SetStateAction<string | null>>;
  setCursorSnapOffset: Dispatch<
    SetStateAction<{
      x: number;
      y: number;
    } | null>
  >;
}): { clearActive: (options?: { delayMagnetReset?: boolean }) => void } {
  const {
    resetMagnet,
    getProjectedMagnetState,
    prefersReducedMotion,
    setIsOver,
    setActiveId,
    setCursorSnapOffset,
  } = params;

  const magnetResetTimeoutRef = useRef<number | null>(null);

  const queueMagnetReset = useCallback(
    (delayMs: number) => {
      if (
        typeof window !== "undefined" &&
        magnetResetTimeoutRef.current !== null
      ) {
        window.clearTimeout(magnetResetTimeoutRef.current);
        magnetResetTimeoutRef.current = null;
      }
      if (delayMs <= 0 || typeof window === "undefined") {
        resetMagnet({ immediate: true });
        return;
      }
      magnetResetTimeoutRef.current = window.setTimeout(() => {
        magnetResetTimeoutRef.current = null;
        resetMagnet({ immediate: true });
      }, delayMs);
    },
    [resetMagnet]
  );

  useEffect(() => {
    return () => {
      if (
        typeof window !== "undefined" &&
        magnetResetTimeoutRef.current !== null
      ) {
        window.clearTimeout(magnetResetTimeoutRef.current);
        magnetResetTimeoutRef.current = null;
      }
    };
  }, []);

  const clearActive = useCallback(
    (options?: { delayMagnetReset?: boolean }) => {
      unstable_batchedUpdates(() => {
        setIsOver(false);
        setActiveId(null);
        setCursorSnapOffset(null);
      });
      const shouldDelay = options?.delayMagnetReset ?? false;
      if (!shouldDelay) {
        queueMagnetReset(0);
        return;
      }
      const currentMagnetState = getProjectedMagnetState();
      const baseDelay = prefersReducedMotion
        ? 130
        : currentMagnetState.shouldSnap
          ? 220
          : 260;
      queueMagnetReset(baseDelay);
    },
    [
      getProjectedMagnetState,
      prefersReducedMotion,
      queueMagnetReset,
      setActiveId,
      setCursorSnapOffset,
      setIsOver,
    ]
  );

  return { clearActive };
}

