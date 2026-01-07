"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { prefetchRoomExperience } from "@/lib/prefetch/prefetchRoomExperience";
import { VictoryRaysPrewarm } from "@/components/ui/pixi/VictoryRaysPrewarm";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

type NetworkInfoLike = {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInfoLike;
};

type RoomExperiencePrewarmProps = {
  roomId: string;
  roomStatus?: string | null;
  disabled?: boolean;
};

const SLOW_TYPES = new Set(["slow-2g", "2g", "3g"]);

const getConnection = (): NetworkInfoLike | null => {
  if (typeof navigator === "undefined") return null;
  return (navigator as NavigatorWithConnection).connection ?? null;
};

const shouldSkipHeavyPrewarm = (): boolean => {
  const conn = getConnection();
  if (!conn) return false;
  if (conn.saveData) return true;
  const type = typeof conn.effectiveType === "string" ? conn.effectiveType.toLowerCase() : "";
  if (SLOW_TYPES.has(type)) return true;
  if (typeof conn.downlink === "number" && conn.downlink < 1.5) return true;
  return false;
};

const scheduleIdleTask = (task: () => void, timeout = 900) => {
  if (typeof window === "undefined") {
    task();
    return () => {};
  }
  const win = window as Window &
    typeof globalThis & {
      requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

  if (typeof win.requestIdleCallback === "function") {
    const handle = win.requestIdleCallback(() => task(), { timeout });
    return () => win.cancelIdleCallback?.(handle);
  }

  const handle = window.setTimeout(task, 250);
  return () => window.clearTimeout(handle);
};

const scheduleSoonTask = (task: () => void) => {
  if (typeof window === "undefined") {
    task();
    return () => {};
  }
  const handle = window.setTimeout(task, 0);
  return () => window.clearTimeout(handle);
};

export function RoomExperiencePrewarm({
  roomId,
  roomStatus,
  disabled = false,
}: RoomExperiencePrewarmProps) {
  const prefersReduced = useReducedMotionPreference();
  const [enableVictoryRays, setEnableVictoryRays] = useState(false);
  const prewarmedRoomRef = useRef<string | null>(null);

  const shouldPrewarm = useMemo(() => {
    if (!roomId || disabled) return false;
    if (roomStatus !== "waiting") return false;
    return true;
  }, [roomId, roomStatus, disabled]);

  const skipHeavy = useMemo(() => {
    if (prefersReduced) return true;
    if (process.env.NEXT_PUBLIC_USE_PIXI_RAYS === "0") return true;
    return shouldSkipHeavyPrewarm();
  }, [prefersReduced]);

  useEffect(() => {
    if (!shouldPrewarm) return () => {};
    if (prewarmedRoomRef.current === roomId) return () => {};
    prewarmedRoomRef.current = roomId;

    let cancelled = false;
    const cancelSoon = scheduleSoonTask(() => {
      if (!cancelled) {
        void prefetchRoomExperience(roomId, { priority: true });
      }
    });
    const cancelIdle = scheduleIdleTask(() => {
      if (cancelled || skipHeavy) return;
      void import("@/lib/pixi/victoryRays").catch(() => undefined);
    });

    return () => {
      cancelled = true;
      cancelSoon();
      cancelIdle();
    };
  }, [roomId, shouldPrewarm, skipHeavy]);

  useEffect(() => {
    if (enableVictoryRays) return () => {};
    if (!shouldPrewarm || skipHeavy) return () => {};

    let cancelled = false;
    const cancel = scheduleIdleTask(() => {
      if (!cancelled) {
        setEnableVictoryRays(true);
      }
    }, 1200);

    return () => {
      cancelled = true;
      cancel();
    };
  }, [enableVictoryRays, shouldPrewarm, skipHeavy]);

  if (!enableVictoryRays) {
    return null;
  }

  return <VictoryRaysPrewarm />;
}

export default RoomExperiencePrewarm;
