"use client";

import React from "react";
import { subscribeRoundPrepare, postRoundPrepare } from "@/lib/utils/broadcast";

const DEFAULT_DURATION = 4500;
const INDICATOR_DELAY = 250;
const MIN_VISIBLE = 450;

type LockOptions = {
  broadcast?: boolean;
  immediate?: boolean;
  delayMs?: number;
};

export function useHostAutoStartLock(
  roomId: string | undefined,
  roomStatus?: string | null
) {
  const [autoStartLocked, setAutoStartLocked] = React.useState<boolean>(() => {
    if (typeof window !== "undefined" && roomId) {
      try {
        const raw = window.localStorage.getItem(`ito:round:${roomId}:prepareUntil`);
        const until = raw ? parseInt(raw, 10) : 0;
        if (!Number.isNaN(until) && until - Date.now() > 50) return true;
      } catch {}
    }
    return false;
  });
  const timerRef = React.useRef<number | null>(null);
  const [showIndicator, setShowIndicator] = React.useState(false);
  const indicatorTimerRef = React.useRef<number | null>(null);
  const hideTimerRef = React.useRef<number | null>(null);
  const minVisibleUntilRef = React.useRef<number>(0);

  const clearTimerRefs = () => {
    try { if (indicatorTimerRef.current!=null) { window.clearTimeout(indicatorTimerRef.current); indicatorTimerRef.current=null; } } catch {}
    try { if (hideTimerRef.current!=null) { window.clearTimeout(hideTimerRef.current); hideTimerRef.current=null; } } catch {}
  };

  const stopTimer = React.useCallback(() => {
    if (typeof window !== "undefined" && timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const beginLock = React.useCallback(
    (duration = DEFAULT_DURATION, options?: LockOptions) => {
      if (!roomId) return;
      setAutoStartLocked(true);
      setShowIndicator(false);
      if (typeof window !== "undefined") {
        stopTimer();
        clearTimerRefs();
        if (options?.immediate) {
          setShowIndicator(true);
          minVisibleUntilRef.current = Date.now() + MIN_VISIBLE;
        } else {
          const delay = typeof options?.delayMs === "number" ? Math.max(0, options!.delayMs!) : INDICATOR_DELAY;
          indicatorTimerRef.current = window.setTimeout(() => {
            setShowIndicator(true);
            minVisibleUntilRef.current = Date.now() + MIN_VISIBLE;
          }, delay);
        }
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          setShowIndicator(false);
          setAutoStartLocked(false);
        }, duration);
        if (options?.broadcast) {
          try {
            window.dispatchEvent(
              new CustomEvent("ito:host-restart", { detail: { roomId, duration } })
            );
          } catch {}
          try { postRoundPrepare(roomId); } catch {}
        }
      }
    },
    [roomId, stopTimer]
  );

  const clearLock = React.useCallback(() => {
    stopTimer();
    if (typeof window === "undefined") {
      setShowIndicator(false);
      setAutoStartLocked(false);
      return;
    }
    if (indicatorTimerRef.current != null) {
      window.clearTimeout(indicatorTimerRef.current);
      indicatorTimerRef.current = null;
    }
    const now = Date.now();
    const remain = Math.max(0, minVisibleUntilRef.current - now);
    if (showIndicator && remain > 0) {
      if (hideTimerRef.current != null) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = window.setTimeout(() => {
        setShowIndicator(false);
        setAutoStartLocked(false);
        hideTimerRef.current = null;
      }, remain);
    } else {
      setShowIndicator(false);
      setAutoStartLocked(false);
    }
  }, [stopTimer, showIndicator]);

  React.useEffect(() => () => { stopTimer(); try { clearTimerRefs(); } catch {} }, [stopTimer]);

  React.useEffect(() => {
    if (!roomId) return;
    return subscribeRoundPrepare(roomId, () => beginLock(DEFAULT_DURATION, { broadcast: false }));
  }, [roomId, beginLock]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !roomId) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string; duration?: number }>).detail;
      if (!detail || detail.roomId !== roomId) return;
      beginLock(detail.duration ?? DEFAULT_DURATION, { broadcast: false });
    };
    window.addEventListener("ito:host-restart", handler as EventListener);
    return () => window.removeEventListener("ito:host-restart", handler as EventListener);
  }, [roomId, beginLock]);

  React.useEffect(() => {
    if (roomStatus && roomStatus !== "waiting") {
      clearLock();
    }
  }, [roomStatus, clearLock]);

  return { autoStartLocked, beginLock, clearLock, showIndicator };
}
