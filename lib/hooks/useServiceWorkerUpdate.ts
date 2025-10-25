import { useCallback, useEffect, useState } from "react";
import {
  applyServiceWorkerUpdate,
  getSafeUpdateSnapshot,
  SafeUpdatePhase,
  SafeUpdateSnapshot,
  subscribeToSafeUpdateSnapshot,
} from "@/lib/serviceWorker/updateChannel";

type UpdateState = {
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
};

export function useServiceWorkerUpdate(): UpdateState {
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
    snapshot.phase === "ready" ||
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
    applyUpdate,
    retryUpdate,
  };
}
