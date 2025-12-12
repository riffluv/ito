"use client";

import React from "react";
import { subscribeRoundPrepare, postRoundPrepare } from "@/lib/utils/broadcast";

const DEFAULT_DURATION = 2600;
const INDICATOR_DELAY = 120;
const MIN_VISIBLE = 360;

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
  const latestStatusRef = React.useRef<string | null>(roomStatus ?? null);
  const lockedFromStatusRef = React.useRef<string | null>(null);
  const maxHoldUntilRef = React.useRef<number>(0);
  const [showIndicator, setShowIndicator] = React.useState(false);
  const indicatorTimerRef = React.useRef<number | null>(null);
  const hideTimerRef = React.useRef<number | null>(null);
  const minVisibleUntilRef = React.useRef<number>(0);

  const clearTimerRefs = () => {
    try {
      if (indicatorTimerRef.current !== null) {
        window.clearTimeout(indicatorTimerRef.current);
        indicatorTimerRef.current = null;
      }
    } catch {}
    try {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    } catch {}
  };

  const stopTimer = React.useCallback(() => {
    if (typeof window !== "undefined" && timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const beginLock = React.useCallback(
    (duration = DEFAULT_DURATION, options?: LockOptions) => {
      if (!roomId) return;
      lockedFromStatusRef.current = roomStatus ?? null;
      // 最長でもこの時間を超えたら解除（サーバーロックTTLと揃える）
      maxHoldUntilRef.current = Date.now() + Math.max(duration, 8000);
      setAutoStartLocked(true);
      setShowIndicator(false);
      if (typeof window !== "undefined") {
        stopTimer();
        clearTimerRefs();
        if (options?.immediate) {
          setShowIndicator(true);
          minVisibleUntilRef.current = Date.now() + MIN_VISIBLE;
        } else {
          const delay =
            typeof options?.delayMs === "number" ? Math.max(0, options.delayMs) : INDICATOR_DELAY;
          indicatorTimerRef.current = window.setTimeout(() => {
            setShowIndicator(true);
            minVisibleUntilRef.current = Date.now() + MIN_VISIBLE;
          }, delay);
        }
        const releaseIfStale = () => {
          timerRef.current = null;
          const fromStatus = lockedFromStatusRef.current;
          const currentStatus = latestStatusRef.current;
          const now = Date.now();
          if (fromStatus && currentStatus === fromStatus && now < maxHoldUntilRef.current) {
            // まだ元フェーズのままなら短い間隔で再チェックして保持する
            timerRef.current = window.setTimeout(releaseIfStale, 500);
            return;
          }
          lockedFromStatusRef.current = null;
          setShowIndicator(false);
          setAutoStartLocked(false);
        };
        timerRef.current = window.setTimeout(releaseIfStale, duration);
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
    [roomId, roomStatus, stopTimer]
  );

  const clearLock = React.useCallback(() => {
    stopTimer();
    lockedFromStatusRef.current = null;
    if (typeof window === "undefined") {
      setShowIndicator(false);
      setAutoStartLocked(false);
      return;
    }
    if (indicatorTimerRef.current !== null) {
      window.clearTimeout(indicatorTimerRef.current);
      indicatorTimerRef.current = null;
    }
    const now = Date.now();
    const remain = Math.max(0, minVisibleUntilRef.current - now);
    if (showIndicator && remain > 0) {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
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

  React.useEffect(() => {
    return () => {
      stopTimer();
      try {
        clearTimerRefs();
      } catch {}
    };
  }, [stopTimer]);

  React.useEffect(() => {
    if (!roomId) return () => undefined;
    return subscribeRoundPrepare(roomId, () => beginLock(DEFAULT_DURATION, { broadcast: false }));
  }, [roomId, beginLock]);

  React.useEffect(() => {
    if (typeof window === "undefined" || !roomId) return () => undefined;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string; duration?: number }>).detail;
      if (!detail || detail.roomId !== roomId) return;
      beginLock(detail.duration ?? DEFAULT_DURATION, { broadcast: false });
    };
    window.addEventListener("ito:host-restart", handler as EventListener);
    return () => window.removeEventListener("ito:host-restart", handler as EventListener);
  }, [roomId, beginLock]);

  React.useEffect(() => {
    latestStatusRef.current = roomStatus ?? null;
    const from = lockedFromStatusRef.current;
    if (!from) return;
    if (roomStatus && roomStatus !== from) {
      clearLock();
    }
  }, [roomStatus, clearLock]);

  return { autoStartLocked, beginLock, clearLock, showIndicator };
}
