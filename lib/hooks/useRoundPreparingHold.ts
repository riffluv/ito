import { useCallback, useEffect, useRef, useState } from "react";

export function useRoundPreparingHold(roundPreparing: boolean, holdMs: number): boolean {
  const [roundPreparingHold, setRoundPreparingHold] = useState(false);
  const holdUntilRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (roundPreparing) {
      holdUntilRef.current = Date.now() + holdMs;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setRoundPreparingHold(false);
      }, holdMs);
      setRoundPreparingHold(true);
      return;
    }

    const remaining = holdUntilRef.current - Date.now();
    if (remaining > 0) {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setRoundPreparingHold(false);
      }, remaining);
      setRoundPreparingHold(true);
    } else {
      clearTimer();
      setRoundPreparingHold(false);
    }
  }, [clearTimer, holdMs, roundPreparing]);

  return roundPreparingHold;
}

