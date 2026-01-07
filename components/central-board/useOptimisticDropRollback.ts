"use client";

import { notify } from "@/components/ui/notify";
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

type PendingStateUpdater = (updater: (prev: (string | null)[]) => (string | null)[]) => void;

export function useOptimisticDropRollback(params: {
  latestActiveProposalRef: MutableRefObject<(string | null)[]>;
  prefersReducedMotion: boolean;
  updatePendingState: PendingStateUpdater;
  onOptimisticProposalChange?: (
    playerId: string,
    state: "placed" | "removed" | null
  ) => void;
}): {
  scheduleDropRollback: (playerId: string, snapshot: (string | null)[]) => void;
  clearDropRollbackTimer: (playerId?: string) => void;
} {
  const {
    latestActiveProposalRef,
    prefersReducedMotion,
    updatePendingState,
    onOptimisticProposalChange,
  } = params;

  const dropRollbackTimersRef = useRef<Map<string, number>>(new Map());
  const dropRollbackSnapshotsRef = useRef<Map<string, (string | null)[]>>(
    new Map()
  );

  const clearDropRollbackTimer = useCallback((playerId?: string) => {
    if (!playerId) {
      if (typeof window !== "undefined") {
        dropRollbackTimersRef.current.forEach((timer) =>
          window.clearTimeout(timer)
        );
      }
      dropRollbackTimersRef.current.clear();
      dropRollbackSnapshotsRef.current.clear();
      return;
    }
    const timer = dropRollbackTimersRef.current.get(playerId);
    if (typeof window !== "undefined" && typeof timer === "number") {
      window.clearTimeout(timer);
    }
    dropRollbackTimersRef.current.delete(playerId);
    dropRollbackSnapshotsRef.current.delete(playerId);
  }, []);

  const scheduleDropRollback = useCallback(
    (playerId: string, snapshot: (string | null)[]) => {
      if (typeof window === "undefined") return;
      clearDropRollbackTimer(playerId);
      dropRollbackSnapshotsRef.current.set(playerId, snapshot.slice());
      const timeoutMs = prefersReducedMotion ? 1400 : 1700;
      const handle = window.setTimeout(() => {
        dropRollbackTimersRef.current.delete(playerId);
        const latestServerProposal = latestActiveProposalRef.current;
        if (latestServerProposal.includes(playerId)) {
          dropRollbackSnapshotsRef.current.delete(playerId);
          return;
        }
        const rollback = dropRollbackSnapshotsRef.current.get(playerId);
        dropRollbackSnapshotsRef.current.delete(playerId);
        if (!rollback) return;
        updatePendingState(() => rollback.slice());
        onOptimisticProposalChange?.(playerId, null);
        notify({
          title: "配置を巻き戻しました",
          description: "サーバー反映が遅延したためローカル状態をリセットしました。",
          type: "info",
          duration: 1400,
        });
      }, timeoutMs);
      dropRollbackTimersRef.current.set(playerId, handle);
    },
    [
      clearDropRollbackTimer,
      latestActiveProposalRef,
      onOptimisticProposalChange,
      prefersReducedMotion,
      updatePendingState,
    ]
  );

  useEffect(() => {
    const dropRollbackTimers = dropRollbackTimersRef.current;
    const dropRollbackSnapshots = dropRollbackSnapshotsRef.current;
    return () => {
      if (typeof window !== "undefined" && dropRollbackTimers.size > 0) {
        dropRollbackTimers.forEach((timer) => window.clearTimeout(timer));
        dropRollbackTimers.clear();
      }
      dropRollbackSnapshots.clear();
    };
  }, []);

  return {
    scheduleDropRollback,
    clearDropRollbackTimer,
  };
}
