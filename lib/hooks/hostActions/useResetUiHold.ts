import { useCallback, useEffect, useRef, useState } from "react";

export function useResetUiHold(params: {
  roomStatus?: string;
}): {
  resetUiPending: boolean;
  beginResetUiHold: (durationMs?: number) => void;
  clearResetUiHold: () => void;
} {
  const { roomStatus } = params;

  const [resetUiPending, setResetUiPending] = useState(false);
  const resetUiTimerRef = useRef<number | null>(null);

  const clearResetUiHold = useCallback(() => {
    if (typeof window !== "undefined" && resetUiTimerRef.current !== null) {
      window.clearTimeout(resetUiTimerRef.current);
      resetUiTimerRef.current = null;
    }
    setResetUiPending(false);
  }, []);

  const beginResetUiHold = useCallback((durationMs = 2800) => {
    if (typeof window === "undefined") return;
    setResetUiPending(true);
    if (resetUiTimerRef.current !== null) {
      window.clearTimeout(resetUiTimerRef.current);
    }
    resetUiTimerRef.current = window.setTimeout(() => {
      setResetUiPending(false);
      resetUiTimerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    if (roomStatus === "waiting") {
      clearResetUiHold();
    }
  }, [roomStatus, clearResetUiHold]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && resetUiTimerRef.current !== null) {
        window.clearTimeout(resetUiTimerRef.current);
        resetUiTimerRef.current = null;
      }
    };
  }, []);

  return { resetUiPending, beginResetUiHold, clearResetUiHold };
}

