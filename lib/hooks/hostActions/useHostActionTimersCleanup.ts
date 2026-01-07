import { useEffect, type MutableRefObject } from "react";

type TimerRef = MutableRefObject<number | null>;

export function useHostActionTimersCleanup(params: {
  quickStartStuckTimerRef: TimerRef;
  quickStartEarlySyncTimerRef: TimerRef;
  nextGameStuckTimerRef: TimerRef;
  nextGameEarlySyncTimerRef: TimerRef;
  resetStuckTimerRef: TimerRef;
  resetEarlySyncTimerRef: TimerRef;
}): void {
  const {
    quickStartStuckTimerRef,
    quickStartEarlySyncTimerRef,
    nextGameStuckTimerRef,
    nextGameEarlySyncTimerRef,
    resetStuckTimerRef,
    resetEarlySyncTimerRef,
  } = params;

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && quickStartStuckTimerRef.current !== null) {
        window.clearTimeout(quickStartStuckTimerRef.current);
        quickStartStuckTimerRef.current = null;
      }
      if (typeof window !== "undefined" && quickStartEarlySyncTimerRef.current !== null) {
        window.clearTimeout(quickStartEarlySyncTimerRef.current);
        quickStartEarlySyncTimerRef.current = null;
      }
      if (typeof window !== "undefined" && nextGameStuckTimerRef.current !== null) {
        window.clearTimeout(nextGameStuckTimerRef.current);
        nextGameStuckTimerRef.current = null;
      }
      if (typeof window !== "undefined" && nextGameEarlySyncTimerRef.current !== null) {
        window.clearTimeout(nextGameEarlySyncTimerRef.current);
        nextGameEarlySyncTimerRef.current = null;
      }
      if (typeof window !== "undefined" && resetStuckTimerRef.current !== null) {
        window.clearTimeout(resetStuckTimerRef.current);
        resetStuckTimerRef.current = null;
      }
      if (typeof window !== "undefined" && resetEarlySyncTimerRef.current !== null) {
        window.clearTimeout(resetEarlySyncTimerRef.current);
        resetEarlySyncTimerRef.current = null;
      }
    };
  }, [
    nextGameEarlySyncTimerRef,
    nextGameStuckTimerRef,
    quickStartEarlySyncTimerRef,
    quickStartStuckTimerRef,
    resetEarlySyncTimerRef,
    resetStuckTimerRef,
  ]);
}

