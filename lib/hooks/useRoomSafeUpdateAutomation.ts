import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { bumpMetric } from "@/lib/utils/metrics";
import {
  applyServiceWorkerUpdate,
  getWaitingServiceWorker,
  holdForceApplyTimer,
  releaseForceApplyTimer,
  resyncWaitingServiceWorker,
  subscribeToServiceWorkerUpdates,
} from "@/lib/serviceWorker/updateChannel";

type SafeUpdateTrigger =
  | "status:waiting"
  | "status:reveal-finished"
  | "status:finished-waiting"
  | "idle";

export function useRoomSafeUpdateAutomation(params: {
  safeUpdateFeatureEnabled: boolean;
  idleApplyMs: number;
  forceApplyDelayMs: number;
  roomStatus: string | null;
  versionMismatch: boolean;
  spectatorUpdateApplying: boolean;
  spectatorUpdateFailed: boolean;
  safeUpdateAutoApplyAt?: number | null;
}): {
  hasWaitingUpdate: boolean;
  safeUpdateActive: boolean;
  safeUpdateAutoApplyCountdown: string | null;
} {
  const {
    safeUpdateFeatureEnabled,
    idleApplyMs,
    forceApplyDelayMs,
    roomStatus,
    versionMismatch,
    spectatorUpdateApplying,
    spectatorUpdateFailed,
    safeUpdateAutoApplyAt,
  } = params;

  const [hasWaitingUpdate, setHasWaitingUpdate] = useState(() =>
    typeof window === "undefined" ? false : getWaitingServiceWorker() !== null
  );
  useEffect(() => {
    return subscribeToServiceWorkerUpdates((registration) => {
      setHasWaitingUpdate(!!registration);
    });
  }, []);

  const safeUpdateActive = useMemo(
    () => safeUpdateFeatureEnabled && (hasWaitingUpdate || spectatorUpdateApplying || spectatorUpdateFailed),
    [hasWaitingUpdate, safeUpdateFeatureEnabled, spectatorUpdateApplying, spectatorUpdateFailed]
  );

  const [safeUpdateAutoApplyCountdown, setSafeUpdateAutoApplyCountdown] = useState<string | null>(null);
  useEffect(() => {
    if (!safeUpdateFeatureEnabled || typeof window === "undefined" || !safeUpdateAutoApplyAt) {
      setSafeUpdateAutoApplyCountdown(null);
      return () => {};
    }
    const updateCountdown = () => {
      const remaining = safeUpdateAutoApplyAt - Date.now();
      if (remaining <= 0) {
        setSafeUpdateAutoApplyCountdown("まもなく自動で更新を適用します");
      } else {
        setSafeUpdateAutoApplyCountdown(`${Math.ceil(remaining / 1000)}秒後に自動適用予定`);
      }
    };
    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [safeUpdateAutoApplyAt, safeUpdateFeatureEnabled]);

  const safeUpdateEnteredRef = useRef(false);
  const safeUpdateStatusRef = useRef<string | null>(null);
  const safeUpdateAutoApplyRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);
  const forceApplyTimerRef = useRef<number | null>(null);
  const lastInteractionTsRef = useRef<number>(typeof window === "undefined" ? 0 : Date.now());
  const versionGuardTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return () => {};
    }

    const clearGuardTimer = () => {
      if (versionGuardTimerRef.current !== null) {
        window.clearTimeout(versionGuardTimerRef.current);
        versionGuardTimerRef.current = null;
      }
    };

    if (!safeUpdateFeatureEnabled || (!versionMismatch && !hasWaitingUpdate)) {
      clearGuardTimer();
      return () => {};
    }

    clearGuardTimer();
    return () => {
      clearGuardTimer();
    };
  }, [hasWaitingUpdate, safeUpdateFeatureEnabled, versionMismatch]);

  useEffect(() => {
    if (!safeUpdateFeatureEnabled || (!versionMismatch && !hasWaitingUpdate) || typeof document === "undefined") {
      return () => {};
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void resyncWaitingServiceWorker("room:visibility-refresh");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [hasWaitingUpdate, safeUpdateFeatureEnabled, versionMismatch]);

  useEffect(() => {
    if (!safeUpdateFeatureEnabled) {
      safeUpdateEnteredRef.current = false;
      return;
    }
    if (safeUpdateActive) {
      if (!safeUpdateEnteredRef.current) {
        safeUpdateEnteredRef.current = true;
        bumpMetric("safeUpdate", "deferred");
      }
    } else {
      safeUpdateEnteredRef.current = false;
    }
  }, [safeUpdateActive, safeUpdateFeatureEnabled]);

  useEffect(() => {
    if (!safeUpdateFeatureEnabled) {
      safeUpdateAutoApplyRef.current = false;
      return;
    }
    if (spectatorUpdateApplying) {
      return;
    }
    if (spectatorUpdateFailed) {
      safeUpdateAutoApplyRef.current = false;
    }
    if (!versionMismatch && !hasWaitingUpdate) {
      safeUpdateAutoApplyRef.current = false;
      return;
    }
    if (safeUpdateAutoApplyRef.current && !spectatorUpdateFailed) {
      return;
    }
    if (!hasWaitingUpdate) {
      void resyncWaitingServiceWorker(
        spectatorUpdateFailed ? "room:auto-retry-failed-resync" : "room:auto-init"
      );
      return;
    }
    const reason = spectatorUpdateFailed
      ? "room:auto-retry-failed"
      : versionMismatch
        ? "room:auto-mismatch"
        : "room:auto-waiting";
    safeUpdateAutoApplyRef.current = true;
    const applied = applyServiceWorkerUpdate({
      reason,
      safeMode: true,
    });
    if (!applied) {
      safeUpdateAutoApplyRef.current = false;
      void resyncWaitingServiceWorker("room:auto-retry");
    }
  }, [
    hasWaitingUpdate,
    safeUpdateFeatureEnabled,
    spectatorUpdateApplying,
    spectatorUpdateFailed,
    versionMismatch,
  ]);

  const tryApplyServiceWorker = useCallback(
    (reason: SafeUpdateTrigger) => {
      if (!safeUpdateFeatureEnabled) return false;
      if (roomStatus && roomStatus !== "waiting") {
        return false;
      }
      const registration = getWaitingServiceWorker();
      const waitingWorker = registration?.waiting;
      if (!registration || !waitingWorker) {
        return false;
      }
      const applied = applyServiceWorkerUpdate({
        reason,
        safeMode: safeUpdateActive,
      });
      return applied;
    },
    [roomStatus, safeUpdateActive, safeUpdateFeatureEnabled]
  );

  useEffect(() => {
    if (!safeUpdateFeatureEnabled) {
      safeUpdateStatusRef.current = roomStatus;
      return;
    }
    if (roomStatus === null) {
      safeUpdateStatusRef.current = null;
      return;
    }
    const previousStatus = safeUpdateStatusRef.current;
    if (hasWaitingUpdate) {
      if (roomStatus === "waiting" && previousStatus !== "waiting") {
        tryApplyServiceWorker("status:waiting");
      } else if (previousStatus === "reveal" && roomStatus === "finished") {
        tryApplyServiceWorker("status:reveal-finished");
      } else if (previousStatus === "finished" && roomStatus === "waiting") {
        tryApplyServiceWorker("status:finished-waiting");
      }
    }
    safeUpdateStatusRef.current = roomStatus;
  }, [hasWaitingUpdate, roomStatus, safeUpdateFeatureEnabled, tryApplyServiceWorker]);

  useEffect(() => {
    const holdReason = "room:safe-update";
    const clearForceApplyTimer = () => {
      if (typeof window !== "undefined" && forceApplyTimerRef.current !== null) {
        window.clearTimeout(forceApplyTimerRef.current);
        forceApplyTimerRef.current = null;
      }
    };
    if (!safeUpdateFeatureEnabled) {
      clearForceApplyTimer();
      releaseForceApplyTimer(holdReason);
      return () => {
        clearForceApplyTimer();
        releaseForceApplyTimer(holdReason);
      };
    }
    const shouldHold = safeUpdateActive && roomStatus && roomStatus !== "waiting";
    if (shouldHold) {
      holdForceApplyTimer(holdReason);
      if (typeof window !== "undefined") {
        clearForceApplyTimer();
        forceApplyTimerRef.current = window.setTimeout(() => {
          forceApplyTimerRef.current = null;
          releaseForceApplyTimer(holdReason);
          const applied = applyServiceWorkerUpdate({
            reason: "room:force-apply",
            safeMode: safeUpdateActive,
          });
          if (!applied) {
            void resyncWaitingServiceWorker("room:force-apply");
          }
        }, forceApplyDelayMs);
      }
    } else {
      clearForceApplyTimer();
      releaseForceApplyTimer(holdReason);
    }
    return () => {
      clearForceApplyTimer();
      releaseForceApplyTimer(holdReason);
    };
  }, [forceApplyDelayMs, roomStatus, safeUpdateActive, safeUpdateFeatureEnabled]);

  useEffect(() => {
    if (!safeUpdateFeatureEnabled) return;
    if (!hasWaitingUpdate) return;
    if (roomStatus === "waiting") {
      tryApplyServiceWorker("status:waiting");
    }
  }, [hasWaitingUpdate, roomStatus, safeUpdateFeatureEnabled, tryApplyServiceWorker]);

  const resetIdleTimer = useCallback(() => {
    if (!safeUpdateFeatureEnabled || idleApplyMs <= 0) {
      if (typeof window !== "undefined" && idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }
    if (typeof window === "undefined") return;
    if (!hasWaitingUpdate) {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return;
    }
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
    }
    lastInteractionTsRef.current = Date.now();
    idleTimerRef.current = window.setTimeout(() => {
      idleTimerRef.current = null;
      if (!safeUpdateFeatureEnabled) return;
      tryApplyServiceWorker("idle");
    }, idleApplyMs);
  }, [hasWaitingUpdate, idleApplyMs, safeUpdateFeatureEnabled, tryApplyServiceWorker]);

  useEffect(() => {
    if (!safeUpdateFeatureEnabled || idleApplyMs <= 0) {
      if (typeof window !== "undefined" && idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      return () => {};
    }
    if (typeof window === "undefined" || typeof document === "undefined") {
      return () => {};
    }
    const handleInteraction = () => {
      lastInteractionTsRef.current = Date.now();
      resetIdleTimer();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        resetIdleTimer();
      }
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
    for (const eventName of events) {
      window.addEventListener(eventName, handleInteraction, true);
    }
    document.addEventListener("visibilitychange", handleVisibility, true);
    resetIdleTimer();
    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, handleInteraction, true);
      }
      document.removeEventListener("visibilitychange", handleVisibility, true);
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [idleApplyMs, resetIdleTimer, safeUpdateFeatureEnabled]);

  useEffect(() => {
    if (!safeUpdateFeatureEnabled || idleApplyMs <= 0) return;
    resetIdleTimer();
  }, [hasWaitingUpdate, idleApplyMs, resetIdleTimer, safeUpdateFeatureEnabled]);

  return {
    hasWaitingUpdate,
    safeUpdateActive,
    safeUpdateAutoApplyCountdown,
  };
}

