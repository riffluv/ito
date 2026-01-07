import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { setMetric } from "@/lib/utils/metrics";

export function useRoomHostAvailability(params: {
  presenceReady: boolean;
  presenceDegraded: boolean;
  onlineUids?: string[] | null;
  hostId: string;
  viewerUid?: string | null;
  graceMs: number;
}): {
  presenceLastSeenRef: React.MutableRefObject<Map<string, number>>;
  hostLikelyUnavailable: boolean;
} {
  const { presenceReady, presenceDegraded, onlineUids, hostId, viewerUid, graceMs } = params;

  const presenceLastSeenRef = useRef<Map<string, number>>(new Map());
  const hostAvailabilityTimerRef = useRef<number | null>(null);
  const hostMissingSinceRef = useRef<number | null>(null);
  const [hostLikelyUnavailable, setHostLikelyUnavailable] = useState(false);

  const clearHostAvailabilityTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (hostAvailabilityTimerRef.current !== null) {
      window.clearTimeout(hostAvailabilityTimerRef.current);
      hostAvailabilityTimerRef.current = null;
    }
  }, []);

  const onlineUidSignature = useMemo(
    () => (Array.isArray(onlineUids) ? onlineUids.join(",") : "_"),
    [onlineUids]
  );
  useEffect(() => {
    if (!presenceReady) return;
    if (!Array.isArray(onlineUids)) return;
    const nowTs = Date.now();
    for (const uid of onlineUids) {
      presenceLastSeenRef.current.set(uid, nowTs);
    }
  }, [presenceReady, onlineUidSignature, onlineUids]);

  useEffect(() => {
    const presenceAvailable = presenceReady || presenceDegraded || Array.isArray(onlineUids);
    if (!presenceAvailable) {
      hostMissingSinceRef.current = null;
      setHostLikelyUnavailable(false);
      clearHostAvailabilityTimer();
      return;
    }
    if (!hostId) {
      hostMissingSinceRef.current = null;
      setHostLikelyUnavailable(true);
      clearHostAvailabilityTimer();
      return;
    }
    if (viewerUid && hostId === viewerUid) {
      hostMissingSinceRef.current = null;
      setHostLikelyUnavailable(false);
      clearHostAvailabilityTimer();
      return;
    }
    if (Array.isArray(onlineUids) && onlineUids.includes(hostId)) {
      hostMissingSinceRef.current = null;
      setHostLikelyUnavailable(false);
      clearHostAvailabilityTimer();
      return;
    }

    const now = Date.now();
    if (!hostMissingSinceRef.current) {
      hostMissingSinceRef.current = now;
      clearHostAvailabilityTimer();
    }

    const missingElapsed = now - (hostMissingSinceRef.current ?? now);
    const remaining = graceMs - missingElapsed;
    if (remaining <= 0) {
      setHostLikelyUnavailable(true);
      clearHostAvailabilityTimer();
      return;
    }

    setHostLikelyUnavailable(false);
    if (typeof window !== "undefined" && hostAvailabilityTimerRef.current === null) {
      hostAvailabilityTimerRef.current = window.setTimeout(() => {
        hostAvailabilityTimerRef.current = null;
        setHostLikelyUnavailable(true);
      }, remaining + 50);
    }
  }, [
    clearHostAvailabilityTimer,
    hostId,
    onlineUids,
    presenceDegraded,
    presenceReady,
    viewerUid,
    graceMs,
  ]);

  useEffect(() => {
    return () => clearHostAvailabilityTimer();
  }, [clearHostAvailabilityTimer]);

  useEffect(() => {
    setMetric("room", "hostLikelyUnavailable", hostLikelyUnavailable ? 1 : 0);
  }, [hostLikelyUnavailable]);

  return { presenceLastSeenRef, hostLikelyUnavailable };
}

