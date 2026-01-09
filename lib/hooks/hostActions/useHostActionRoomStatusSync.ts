import { useEffect } from "react";

import { setMetric } from "@/lib/utils/metrics";
import { clearTimerRef } from "@/lib/hooks/hostActions/timers";

export function useHostActionRoomStatusSync(params: {
  roomStatus?: string;
  quickStartStuckTimerRef: { current: number | null };
  quickStartEarlySyncTimerRef: { current: number | null };
  nextGameStuckTimerRef: { current: number | null };
  nextGameEarlySyncTimerRef: { current: number | null };
  resetStuckTimerRef: { current: number | null };
  resetEarlySyncTimerRef: { current: number | null };
  expectedStatusVersionRef: {
    current: { quickStart: number | null; nextGame: number | null; reset: number | null };
  };
  resetOkAtRef: { current: number | null };
  quickStartOkAtRef: { current: number | null };
  nextGameOkAtRef: { current: number | null };
  setQuickStartPending: (value: boolean) => void;
  setIsRestarting: (value: boolean) => void;
}): void {
  const {
    roomStatus,
    quickStartStuckTimerRef,
    quickStartEarlySyncTimerRef,
    nextGameStuckTimerRef,
    nextGameEarlySyncTimerRef,
    resetStuckTimerRef,
    resetEarlySyncTimerRef,
    expectedStatusVersionRef,
    resetOkAtRef,
    quickStartOkAtRef,
    nextGameOkAtRef,
    setQuickStartPending,
    setIsRestarting,
  } = params;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (roomStatus && roomStatus !== "waiting") {
      clearTimerRef(quickStartStuckTimerRef);
      clearTimerRef(quickStartEarlySyncTimerRef);
    }
    if (roomStatus === "clue") {
      clearTimerRef(nextGameStuckTimerRef);
      clearTimerRef(nextGameEarlySyncTimerRef);
    }
    if (roomStatus === "waiting") {
      clearTimerRef(resetStuckTimerRef);
      clearTimerRef(resetEarlySyncTimerRef);
      expectedStatusVersionRef.current.reset = null;
      setMetric("hostAction", "reset.expectedStatusVersion", null);
      if (typeof performance !== "undefined" && resetOkAtRef.current !== null) {
        setMetric(
          "hostAction",
          "reset.statusSyncMs",
          Math.max(0, Math.round(performance.now() - resetOkAtRef.current))
        );
      }
      resetOkAtRef.current = null;
    }
    if (roomStatus === "clue") {
      if (typeof performance !== "undefined") {
        if (quickStartOkAtRef.current !== null) {
          setMetric(
            "hostAction",
            "quickStart.statusSyncMs",
            Math.max(0, Math.round(performance.now() - quickStartOkAtRef.current))
          );
        }
        if (nextGameOkAtRef.current !== null) {
          setMetric(
            "hostAction",
            "nextGame.statusSyncMs",
            Math.max(0, Math.round(performance.now() - nextGameOkAtRef.current))
          );
        }
      }
      quickStartOkAtRef.current = null;
      nextGameOkAtRef.current = null;
      expectedStatusVersionRef.current.quickStart = null;
      expectedStatusVersionRef.current.nextGame = null;
      setMetric("hostAction", "quickStart.expectedStatusVersion", null);
      setMetric("hostAction", "nextGame.expectedStatusVersion", null);
      setQuickStartPending(false);
      setIsRestarting(false);
    }
  }, [
    expectedStatusVersionRef,
    nextGameEarlySyncTimerRef,
    nextGameOkAtRef,
    nextGameStuckTimerRef,
    quickStartEarlySyncTimerRef,
    quickStartOkAtRef,
    quickStartStuckTimerRef,
    resetEarlySyncTimerRef,
    resetOkAtRef,
    resetStuckTimerRef,
    roomStatus,
    setIsRestarting,
    setQuickStartPending,
  ]);
}
