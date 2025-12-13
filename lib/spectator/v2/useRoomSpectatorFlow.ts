"use client";

import { notify } from "@/components/ui/notify";
import {
  useSpectatorController,
  type SeatRequestViewState,
  type SpectatorMachineState,
} from "@/lib/spectator/v2/useSpectatorController";
import type { UseSpectatorSessionResult } from "@/lib/spectator/v2/useSpectatorSession";
import type {
  RoomMachineClientEvent,
  SpectatorReason,
  SpectatorRequestSource,
  SpectatorStatus,
} from "@/lib/state/roomMachine";
import type { RoomStatus } from "@/lib/state/guards";
import { logDebug } from "@/lib/utils/log";
import { bumpMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

type SpectatorFsmInputs = {
  status: SpectatorStatus;
  node: SpectatorStatus;
  reason: SpectatorReason;
  requestSource: SpectatorRequestSource;
  requestStatus: SeatRequestViewState["status"];
  requestCreatedAt: number | null;
  requestFailure: string | null;
  error: string | null;
};

export function useRoomSpectatorFlow({
  roomId,
  uid,
  isHost,
  isMember,
  spectatorFsm,
  versionMismatchBlocksAccess,
  emitSpectatorEvent,
  leavingRef,
  spectatorSession,
  spectatorRecallEnabled,
  roomStatus,
  recallOpen,
  setForcedExitReason,
  reattachPresence,
}: {
  roomId: string;
  uid: string | null;
  isHost: boolean;
  isMember: boolean;
  spectatorFsm: SpectatorFsmInputs;
  versionMismatchBlocksAccess: boolean;
  emitSpectatorEvent: (event: RoomMachineClientEvent) => void;
  leavingRef: MutableRefObject<boolean>;
  spectatorSession: UseSpectatorSessionResult;
  spectatorRecallEnabled: boolean;
  roomStatus: RoomStatus | null;
  recallOpen: boolean;
  setForcedExitReason: (reason: "game-in-progress" | "version-mismatch" | null) => void;
  reattachPresence?: (() => Promise<void> | void) | null;
}) {
  const [seatRequestTimedOut, setSeatRequestTimedOut] = useState(false);
  const prevSeatRequestStatusRef = useRef<SeatRequestViewState["status"]>(
    spectatorFsm.requestStatus
  );
  const seatRequestTimeoutTriggeredRef = useRef(false);
  const spectatorTimeoutPrevRef = useRef(false);
  const reattachScheduledRef = useRef(false);
  const spectatorEnteredRef = useRef(false);

  const isSpectatorMode = !isMember && !isHost && spectatorFsm.node !== "idle";

  const spectatorMachineState = useMemo<SpectatorMachineState>(
    () => ({
      status: spectatorFsm.status,
      node: spectatorFsm.node,
      reason: spectatorFsm.reason,
      requestSource: spectatorFsm.requestSource,
      requestStatus: spectatorFsm.requestStatus,
      requestCreatedAt: spectatorFsm.requestCreatedAt,
      requestFailure: spectatorFsm.requestFailure,
      error: spectatorFsm.error,
    }),
    [
      spectatorFsm.status,
      spectatorFsm.node,
      spectatorFsm.reason,
      spectatorFsm.requestSource,
      spectatorFsm.requestStatus,
      spectatorFsm.requestCreatedAt,
      spectatorFsm.requestFailure,
      spectatorFsm.error,
    ]
  );

  const spectatorController = useSpectatorController({
    roomId,
    uid,
    isSpectatorMode,
    spectatorMachineState,
    versionMismatchBlocksAccess,
    emitSpectatorEvent,
    setSeatRequestTimedOut,
    leavingRef,
    spectatorSession,
  });

  const {
    state: {
      seatRequest: seatRequestState,
      seatRequestPending,
      seatRequestAccepted,
      seatAcceptanceActive,
    },
    actions: {
      clearRejoinIntent,
      suppressAutoJoinIntent,
      clearPendingSeatRequest,
      handleSeatRecovery,
      cancelSeatRequestSafely,
    },
    utils: { hasPendingSeatRequest, consumePendingSeatRequest },
  } = spectatorController;

  useEffect(() => {
    if (seatRequestState.status !== "pending") return;
    if (spectatorRecallEnabled) return;
    if (!uid) return;
    clearPendingSeatRequest();
    emitSpectatorEvent({ type: "SPECTATOR_RESET" });
    setSeatRequestTimedOut(false);
    clearRejoinIntent();
    void cancelSeatRequestSafely();
  }, [
    seatRequestState.status,
    spectatorRecallEnabled,
    clearPendingSeatRequest,
    uid,
    roomId,
    clearRejoinIntent,
    cancelSeatRequestSafely,
    emitSpectatorEvent,
  ]);

  useEffect(() => {
    if (seatRequestState.status === "pending") return;
    clearRejoinIntent();
  }, [seatRequestState.status, clearRejoinIntent]);

  useEffect(() => {
    if (!seatRequestAccepted) {
      reattachScheduledRef.current = false;
      return;
    }
    if (typeof reattachPresence !== "function") return;
    if (reattachScheduledRef.current) return;
    reattachScheduledRef.current = true;
    Promise.resolve(reattachPresence()).catch((error) => {
      logDebug("room-page", "reattach-presence-failed", error);
      reattachScheduledRef.current = false;
    });
  }, [seatRequestAccepted, reattachPresence]);

  useEffect(() => {
    if (!isSpectatorMode) {
      spectatorTimeoutPrevRef.current = false;
      return;
    }
    if (seatRequestTimedOut && !spectatorTimeoutPrevRef.current) {
      traceAction("spectator.request.timeout", {
        roomId,
        uid,
        source: seatRequestState.source ?? null,
      });
      emitSpectatorEvent({ type: "SPECTATOR_TIMEOUT" });
    }
    spectatorTimeoutPrevRef.current = seatRequestTimedOut;
  }, [
    emitSpectatorEvent,
    isSpectatorMode,
    seatRequestTimedOut,
    roomId,
    uid,
    seatRequestState.source,
  ]);

  useEffect(() => {
    if (!isSpectatorMode) {
      spectatorEnteredRef.current = false;
      return;
    }
    if (spectatorEnteredRef.current) {
      return;
    }
    spectatorEnteredRef.current = true;
    if (seatRequestState.status !== "idle") {
      emitSpectatorEvent({ type: "SPECTATOR_RESET" });
    }
    clearPendingSeatRequest();
    setSeatRequestTimedOut(false);
    leavingRef.current = false;
    if (seatRequestState.status !== "idle") {
      void cancelSeatRequestSafely();
    }
  }, [
    isSpectatorMode,
    leavingRef,
    seatRequestState.status,
    emitSpectatorEvent,
    cancelSeatRequestSafely,
    clearPendingSeatRequest,
  ]);

  const performSeatRecovery = useCallback(
    ({
      silent,
      source,
    }: {
      silent: boolean;
      source: Exclude<SpectatorRequestSource, null>;
    }) => {
      return handleSeatRecovery({
        silent,
        source,
        spectatorRecallEnabled,
        roomStatus,
        recallOpen,
        notify,
      });
    },
    [handleSeatRecovery, spectatorRecallEnabled, roomStatus, recallOpen]
  );

  const handleRetryJoin = useCallback(async () => {
    await performSeatRecovery({ silent: false, source: "manual" });
  }, [performSeatRecovery]);

  const autoRecallAttemptsRef = useRef(0);
  const autoRecallTimerRef = useRef<number | null>(null);
  const pendingRecallRecoveryRef = useRef(false);

  const resetAutoRecall = useCallback(() => {
    autoRecallAttemptsRef.current = 0;
    if (autoRecallTimerRef.current !== null) {
      window.clearTimeout(autoRecallTimerRef.current);
      autoRecallTimerRef.current = null;
    }
  }, []);

  const attemptAutoRecall = useCallback(
    async (source: Exclude<SpectatorRequestSource, null> = "auto") => {
      if (!spectatorRecallEnabled || !isSpectatorMode) return;
      if (seatRequestPending || seatAcceptanceActive) return;
      if (autoRecallAttemptsRef.current >= 3) return;

      autoRecallAttemptsRef.current += 1;
      bumpMetric("spectator", "autoRecallAttempt");
      try {
        const ok = await performSeatRecovery({ silent: true, source });
        traceAction("spectator.autoRecall", {
          roomId,
          source,
          ok,
          attempt: autoRecallAttemptsRef.current,
        });
        bumpMetric("spectator", ok ? "autoRecallSuccess" : "autoRecallFailure");
        if (!ok && autoRecallAttemptsRef.current < 3) {
          autoRecallTimerRef.current = window.setTimeout(
            () => void attemptAutoRecall(source),
            3000
          );
        }
      } catch (error) {
        traceError("spectator.autoRecall.failed", error, {
          roomId,
          source,
          attempt: autoRecallAttemptsRef.current,
        });
        bumpMetric("spectator", "autoRecallFailure");
        if (autoRecallAttemptsRef.current < 3) {
          autoRecallTimerRef.current = window.setTimeout(
            () => void attemptAutoRecall(source),
            3000
          );
        }
      }
    },
    [
      spectatorRecallEnabled,
      isSpectatorMode,
      seatRequestPending,
      seatAcceptanceActive,
      performSeatRecovery,
      roomId,
    ]
  );

  // リセット後に pending が残ったままの場合、いったんキャンセルして再送する
  useEffect(() => {
    if (seatRequestState.status !== "pending") {
      pendingRecallRecoveryRef.current = false;
      return;
    }
    if (!spectatorRecallEnabled) return;
    if (roomStatus !== "waiting" || !recallOpen) return;
    if (pendingRecallRecoveryRef.current) return;

    pendingRecallRecoveryRef.current = true;
    const source =
      (seatRequestState.source as Exclude<SpectatorRequestSource, null> | null) ??
      "auto";

    void (async () => {
      await cancelSeatRequestSafely();
      await performSeatRecovery({ silent: true, source });
    })();
  }, [
    seatRequestState.status,
    seatRequestState.source,
    spectatorRecallEnabled,
    roomStatus,
    recallOpen,
    cancelSeatRequestSafely,
    performSeatRecovery,
  ]);

  useEffect(() => {
    resetAutoRecall();
    const cleanup = () => resetAutoRecall();
    if (!spectatorRecallEnabled || !isSpectatorMode) return cleanup;
    if (seatRequestPending || seatAcceptanceActive) return cleanup;
    const pendingSource = hasPendingSeatRequest()
      ? consumePendingSeatRequest() ?? "manual"
      : null;
    void attemptAutoRecall(
      (pendingSource as Exclude<SpectatorRequestSource, null> | null) ?? "auto"
    );
    return cleanup;
  }, [
    spectatorRecallEnabled,
    isSpectatorMode,
    seatRequestPending,
    seatAcceptanceActive,
    hasPendingSeatRequest,
    consumePendingSeatRequest,
    attemptAutoRecall,
    resetAutoRecall,
  ]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      resetAutoRecall();
      const pendingSource = hasPendingSeatRequest()
        ? consumePendingSeatRequest() ?? "manual"
        : null;
      void attemptAutoRecall(
        (pendingSource as Exclude<SpectatorRequestSource, null> | null) ?? "auto"
      );
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [
    attemptAutoRecall,
    resetAutoRecall,
    hasPendingSeatRequest,
    consumePendingSeatRequest,
  ]);

  useEffect(() => {
    if (seatRequestState.status !== "pending" || !seatRequestState.requestedAt) {
      setSeatRequestTimedOut(false);
      seatRequestTimeoutTriggeredRef.current = false;
      return () => {};
    }
    const timeoutMs = 15000;
    const now = Date.now();
    const remaining = Math.max(timeoutMs - (now - seatRequestState.requestedAt), 0);
    if (remaining <= 0) {
      if (!seatRequestTimeoutTriggeredRef.current) {
        seatRequestTimeoutTriggeredRef.current = true;
        setSeatRequestTimedOut(true);
      }
      return () => {};
    }
    seatRequestTimeoutTriggeredRef.current = false;
    const timer = window.setTimeout(() => {
      seatRequestTimeoutTriggeredRef.current = true;
      setSeatRequestTimedOut(true);
    }, remaining);
    return () => {
      window.clearTimeout(timer);
    };
  }, [seatRequestState.status, seatRequestState.requestedAt]);

  useEffect(() => {
    const currentStatus = seatRequestState.status;
    const previousStatus = prevSeatRequestStatusRef.current;
    if (currentStatus !== previousStatus) {
      if (currentStatus === "accepted") {
        traceAction("spectator.request.accepted", {
          roomId,
          uid,
          source: seatRequestState.source ?? null,
        });
        leavingRef.current = false;
        setForcedExitReason(null);
        setSeatRequestTimedOut(false);
      } else if (currentStatus === "rejected") {
        traceAction("spectator.request.rejected", {
          roomId,
          uid,
          source: seatRequestState.source ?? null,
          failure: seatRequestState.error ?? null,
        });
        leavingRef.current = false;
        setSeatRequestTimedOut(false);
      } else if (currentStatus === "pending") {
        traceAction("spectator.request.pending", {
          roomId,
          uid,
          source: seatRequestState.source ?? null,
        });
      } else if (
        previousStatus === "pending" &&
        currentStatus === "idle" &&
        isSpectatorMode &&
        roomStatus === "waiting"
      ) {
        try {
          notify({
            title: "リクエストをリセットしました",
            description: "ホストの操作に合わせて再度「席に戻る」を押してください。",
            type: "info",
          });
        } catch (error) {
          logDebug("room-page", "notify-seat-request-reset-failed", error);
        }
      } else {
        setSeatRequestTimedOut(false);
      }
      prevSeatRequestStatusRef.current = currentStatus;
    }
    if (currentStatus !== "pending") {
      seatRequestTimeoutTriggeredRef.current = false;
    }
  }, [
    seatRequestState.status,
    seatRequestState.source,
    seatRequestState.error,
    leavingRef,
    setForcedExitReason,
    roomId,
    uid,
    isSpectatorMode,
    roomStatus,
  ]);

  return {
    isSpectatorMode,
    seatRequestTimedOut,
    spectatorController,
    handleRetryJoin,
    // re-export to keep RoomLayout dependencies stable
    seatAcceptanceActive,
    seatRequestPending,
    seatRequestAccepted,
    clearRejoinIntent,
    suppressAutoJoinIntent,
    cancelSeatRequestSafely,
  };
}
