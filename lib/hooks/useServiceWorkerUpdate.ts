import { useCallback, useEffect, useState } from "react";
import {
  applyServiceWorkerUpdate,
  getSafeUpdateSnapshot,
  SafeUpdatePhase,
  SafeUpdateSnapshot,
  subscribeToSafeUpdateSnapshot,
} from "@/lib/serviceWorker/updateChannel";
import { setMetric } from "@/lib/utils/metrics";

export type ServiceWorkerUpdateState = {
  isUpdateReady: boolean;
  isApplying: boolean;
  hasError: boolean;
  phase: SafeUpdatePhase;
  waitingSince: number | null;
  waitingVersion: string | null;
  lastError: string | null;
  lastCheckAt: number | null;
  autoApplySuppressed: boolean;
  isReloadPending: boolean;
  applyReason: string | null;
  autoApplyAt: number | null;
  retryCount: number;
  applyUpdate: () => void;
  retryUpdate: () => void;
};

const EMPTY_SNAPSHOT: SafeUpdateSnapshot = {
  phase: "idle",
  waitingSince: null,
  waitingVersion: null,
  lastCheckAt: null,
  lastError: null,
  autoApplySuppressed: false,
  pendingReload: false,
  applyReason: null,
  autoApplyAt: null,
  retryCount: 0,
};

export function useServiceWorkerUpdate(): ServiceWorkerUpdateState {
  const [snapshot, setSnapshot] = useState<SafeUpdateSnapshot>(() => {
    if (typeof window === "undefined") {
      return EMPTY_SNAPSHOT;
    }
    return getSafeUpdateSnapshot();
  });

  useEffect(() => {
    return subscribeToSafeUpdateSnapshot((next) => {
      setSnapshot(next);
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMetric("safeUpdate", "phase", snapshot.phase);
    setMetric("safeUpdate", "waitingVersion", snapshot.waitingVersion ?? "");
    setMetric("safeUpdate", "waitingSinceMs", snapshot.waitingSince ?? 0);
    setMetric("safeUpdate", "autoSuppressed", snapshot.autoApplySuppressed ? 1 : 0);
    setMetric("safeUpdate", "retryCount", snapshot.retryCount);
  }, [
    snapshot.phase,
    snapshot.waitingVersion,
    snapshot.waitingSince,
    snapshot.autoApplySuppressed,
    snapshot.retryCount,
  ]);

  const applyUpdate = useCallback(() => {
    if (snapshot.phase === "applying") {
      return;
    }
    applyServiceWorkerUpdate({ reason: "manual" });
  }, [snapshot.phase]);

  const retryUpdate = useCallback(() => {
    applyServiceWorkerUpdate({ reason: "manual" });
  }, []);

  const isUpdateReady =
    snapshot.phase === "update_detected" ||
    snapshot.phase === "auto_pending" ||
    snapshot.phase === "waiting_user" ||
    snapshot.phase === "suppressed" ||
    snapshot.phase === "applying" ||
    snapshot.phase === "failed";

  return {
    isUpdateReady,
    isApplying: snapshot.phase === "applying",
    hasError: snapshot.phase === "failed",
    phase: snapshot.phase,
    waitingSince: snapshot.waitingSince,
    waitingVersion: snapshot.waitingVersion,
    lastError: snapshot.lastError,
    lastCheckAt: snapshot.lastCheckAt,
    autoApplySuppressed: snapshot.autoApplySuppressed,
    isReloadPending: snapshot.pendingReload,
    applyReason: snapshot.applyReason,
    autoApplyAt: snapshot.autoApplyAt,
    retryCount: snapshot.retryCount,
    applyUpdate,
    retryUpdate,
  };
}
