import { useEffect } from "react";

import { clearTimerRef, type TimerRef } from "@/lib/hooks/hostActions/timers";

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
      clearTimerRef(quickStartStuckTimerRef);
      clearTimerRef(quickStartEarlySyncTimerRef);
      clearTimerRef(nextGameStuckTimerRef);
      clearTimerRef(nextGameEarlySyncTimerRef);
      clearTimerRef(resetStuckTimerRef);
      clearTimerRef(resetEarlySyncTimerRef);
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
