"use client";

import { notify } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { setMetric, readMetrics } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";
import React from "react";

const noopCleanup = () => {};

type SyncSpinnerWatchdogParams = {
  roomId: string;
  roomStatus?: string;
  quickStartPending: boolean;
  isRestarting: boolean;
  autoStartLocked: boolean;
  roundPreparing: boolean;
  showSpinner: boolean;
  effectiveSpinnerText: string;
};

export function useSyncSpinnerWatchdog(params: SyncSpinnerWatchdogParams) {
  const {
    roomId,
    roomStatus,
    quickStartPending,
    isRestarting,
    autoStartLocked,
    roundPreparing,
    showSpinner,
    effectiveSpinnerText,
  } = params;

  const syncSpinnerWatchdogRef = React.useRef<number | null>(null);
  const syncSpinnerLoggedRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return noopCleanup;
    }
    const syncPending = quickStartPending || isRestarting;
    if (!syncPending || roomStatus === "clue") {
      syncSpinnerLoggedRef.current = false;
      if (syncSpinnerWatchdogRef.current !== null) {
        window.clearTimeout(syncSpinnerWatchdogRef.current);
        syncSpinnerWatchdogRef.current = null;
      }
      return noopCleanup;
    }

    if (syncSpinnerLoggedRef.current || syncSpinnerWatchdogRef.current !== null) {
      return noopCleanup;
    }

    syncSpinnerWatchdogRef.current = window.setTimeout(() => {
      syncSpinnerWatchdogRef.current = null;
      if (syncSpinnerLoggedRef.current) return;
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const metrics = readMetrics();
      const lastSnapshotTsRaw = (
        metrics as { roomSnapshot?: { lastSnapshotTs?: unknown } }
      ).roomSnapshot?.lastSnapshotTs;
      const lastSnapshotTs =
        typeof lastSnapshotTsRaw === "number" && Number.isFinite(lastSnapshotTsRaw)
          ? lastSnapshotTsRaw
          : null;
      const snapshotAgeMs =
        typeof lastSnapshotTs === "number" ? Math.max(0, now - lastSnapshotTs) : null;

      setMetric("hostAction", "syncSpinner.stuckAt", now);
      setMetric("hostAction", "syncSpinner.roomStatus", roomStatus ?? "unknown");
      setMetric(
        "hostAction",
        "syncSpinner.reason",
        quickStartPending
          ? "quickStartPending"
          : isRestarting
            ? "isRestarting"
            : "unknown"
      );
      if (snapshotAgeMs !== null) {
        setMetric("hostAction", "syncSpinner.snapshotAgeMs", Math.round(snapshotAgeMs));
      }

      traceAction("ui.syncSpinner.stuck", {
        roomId,
        roomStatus: roomStatus ?? "unknown",
        quickStartPending: quickStartPending ? "1" : "0",
        isRestarting: isRestarting ? "1" : "0",
        autoStartLocked: autoStartLocked ? "1" : "0",
        roundPreparing: roundPreparing ? "1" : "0",
        showSpinner: showSpinner ? "1" : "0",
        spinnerText: effectiveSpinnerText,
        visibility: document.visibilityState,
        online:
          typeof navigator !== "undefined"
            ? navigator.onLine
              ? "1"
              : "0"
            : "unknown",
        snapshotAgeMs: snapshotAgeMs === null ? undefined : String(Math.round(snapshotAgeMs)),
      });

      try {
        window.dispatchEvent(
          new CustomEvent("ito:room-force-refresh", {
            detail: { roomId, reason: "ui.syncSpinner.stuck" },
          })
        );
      } catch {}
      try {
        window.dispatchEvent(
          new CustomEvent("ito:room-restart-listener", {
            detail: { roomId, reason: "ui.syncSpinner.stuck" },
          })
        );
      } catch {}

      notify({
        id: toastIds.genericInfo(roomId, "sync-spinner-stuck"),
        title: "状態の同期が遅れています",
        description: "最新の状態を取得します。改善しない場合はページを再読み込みしてください。",
        type: "warning",
        duration: 4200,
      });

      syncSpinnerLoggedRef.current = true;
    }, 5000);

    return () => {
      if (syncSpinnerWatchdogRef.current !== null) {
        window.clearTimeout(syncSpinnerWatchdogRef.current);
        syncSpinnerWatchdogRef.current = null;
      }
    };
  }, [
    autoStartLocked,
    effectiveSpinnerText,
    isRestarting,
    quickStartPending,
    roomId,
    roomStatus,
    roundPreparing,
    showSpinner,
  ]);
}
