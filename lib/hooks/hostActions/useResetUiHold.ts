import { useCallback, useEffect, useRef, useState } from "react";

import { clearTimerRef } from "@/lib/hooks/hostActions/timers";

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
    clearTimerRef(resetUiTimerRef);
    setResetUiPending(false);
  }, []);

  const beginResetUiHold = useCallback((durationMs = 2800) => {
    if (typeof window === "undefined") return;
    setResetUiPending(true);
    clearTimerRef(resetUiTimerRef);
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
      clearTimerRef(resetUiTimerRef);
    };
  }, []);

  return { resetUiPending, beginResetUiHold, clearResetUiHold };
}
