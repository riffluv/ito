import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MutableRefObject, Dispatch, SetStateAction } from "react";
import type {
  SpectatorReason,
  SpectatorRequestSource,
  SpectatorStatus,
} from "@/lib/state/roomMachine";
import type { RoomMachineClientEvent } from "@/lib/state/roomMachine";
import { clearAutoJoinSuppressFlag } from "@/lib/spectator/sessionFlags";
import { logDebug } from "@/lib/utils/log";
import { logSpectatorRequestEnqueue } from "@/lib/spectator/telemetry";
import type { RoomStatus } from "@/lib/state/guards";
import { cancelSeatRequest } from "@/lib/game/service";
import { traceAction } from "@/lib/utils/trace";

type NotifyPayload =
  | string
  | {
      title?: string;
      description?: string;
      type?: "info" | "warning" | "success" | "error";
      duration?: number;
      id?: string | number;
      [key: string]: any;
    };

export type HandleSeatRecoveryOptions = {
  silent: boolean;
  source: Exclude<SpectatorRequestSource, null>;
  spectatorRecallEnabled: boolean;
  roomStatus: RoomStatus | null;
  recallOpen: boolean;
  notify: (payload: NotifyPayload) => void;
  requestSeatNow: (source: Exclude<SpectatorRequestSource, null>) => void;
};

export type SeatRequestViewState = {
  status: "idle" | "pending" | "accepted" | "rejected";
  source: SpectatorRequestSource | null;
  requestedAt: number | null;
  error?: string | null;
};

export type SpectatorMachineState = {
  status: SpectatorStatus;
  node: SpectatorStatus;
  reason: SpectatorReason;
  requestSource: SpectatorRequestSource;
  requestStatus: SeatRequestViewState["status"];
  requestCreatedAt: number | null;
  requestFailure: string | null;
  error: string | null;
};

type UseSpectatorFlowParams = {
  roomId: string;
  uid: string | null;
  rejoinSessionKey: string | null;
  autoJoinSuppressKey: string | null;
  isSpectatorMode: boolean;
  spectatorMachineState: SpectatorMachineState;
  versionMismatchBlocksAccess: boolean;
  emitSpectatorEvent: (event: RoomMachineClientEvent) => void;
  setSeatRequestTimedOut: Dispatch<SetStateAction<boolean>>;
  leavingRef: MutableRefObject<boolean>;
};

export type UseSpectatorFlowResult = {
  spectatorReason: SpectatorReason | null;
  seatRequestSource: SpectatorRequestSource | null;
  seatRequestPending: boolean;
  seatRequestAccepted: boolean;
  seatRequestRejected: boolean;
  seatAcceptanceActive: boolean;
  seatRequestState: SeatRequestViewState;
  seatRequestButtonDisabled: boolean;
  rememberRejoinIntent: () => void;
  clearRejoinIntent: () => void;
  hasRejoinIntent: () => boolean;
  clearAutoJoinSuppress: () => void;
  suppressAutoJoinIntent: () => void;
  queuePendingSeatRequest: (source: SpectatorRequestSource) => void;
  clearPendingSeatRequest: () => void;
  consumePendingSeatRequest: () => SpectatorRequestSource | null;
  hasPendingSeatRequest: () => boolean;
  markSeatRequestIntent: (source: SpectatorRequestSource, canRequestNow: boolean) => void;
  cancelSeatRequestSafely: () => Promise<boolean>;
  handleSeatRecovery: (options: HandleSeatRecoveryOptions) => Promise<boolean>;
};

export function useSpectatorFlow({
  roomId,
  uid,
  rejoinSessionKey,
  autoJoinSuppressKey,
  isSpectatorMode,
  spectatorMachineState,
  versionMismatchBlocksAccess,
  emitSpectatorEvent,
  setSeatRequestTimedOut,
  leavingRef,
}: UseSpectatorFlowParams): UseSpectatorFlowResult {
  const seatRequestState = useMemo<SeatRequestViewState>(
    () => ({
      status: spectatorMachineState.requestStatus,
      source: spectatorMachineState.requestSource,
      requestedAt: spectatorMachineState.requestCreatedAt,
      error: spectatorMachineState.requestFailure ?? spectatorMachineState.error ?? null,
    }),
    [
      spectatorMachineState.requestStatus,
      spectatorMachineState.requestSource,
      spectatorMachineState.requestCreatedAt,
      spectatorMachineState.requestFailure,
      spectatorMachineState.error,
    ]
  );

  const seatRequestPending = seatRequestState.status === "pending";
  const seatRequestAccepted = seatRequestState.status === "accepted";
  const seatRequestRejected = seatRequestState.status === "rejected";
  const seatAcceptanceActive = seatRequestAccepted;
  const seatRequestSource = seatRequestState.source;

  const spectatorReason = useMemo<SpectatorReason | null>(() => {
    if (!isSpectatorMode) {
      return null;
    }
    return spectatorMachineState.reason;
  }, [isSpectatorMode, spectatorMachineState.reason]);

  const spectatorReasonPrevRef = useRef<SpectatorReason | null>(null);
  useEffect(() => {
    if (!isSpectatorMode) {
      spectatorReasonPrevRef.current = null;
      return;
    }
    const previous = spectatorReasonPrevRef.current;
    if (previous !== spectatorReason) {
      emitSpectatorEvent({
        type: "SPECTATOR_REASON_UPDATE",
        reason: spectatorReason,
      });
      spectatorReasonPrevRef.current = spectatorReason;
    }
  }, [emitSpectatorEvent, isSpectatorMode, spectatorReason]);

  const seatRequestButtonDisabled =
    versionMismatchBlocksAccess || seatRequestPending || seatAcceptanceActive;

  const pendingSeatRequestRef = useRef<SpectatorRequestSource | null>(null);
  const queuePendingSeatRequest = useCallback(
    (source: SpectatorRequestSource) => {
      pendingSeatRequestRef.current = source;
    },
    []
  );
  const clearPendingSeatRequest = useCallback(() => {
    pendingSeatRequestRef.current = null;
  }, []);
  const consumePendingSeatRequest = useCallback((): SpectatorRequestSource | null => {
    const queued = pendingSeatRequestRef.current;
    pendingSeatRequestRef.current = null;
    return queued ?? null;
  }, []);
  const hasPendingSeatRequest = useCallback(() => {
    return pendingSeatRequestRef.current !== null;
  }, []);

  const rememberRejoinIntent = useCallback(() => {
    if (!rejoinSessionKey || !uid) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(rejoinSessionKey, uid);
    } catch (error) {
      logDebug("spectator-flow", "rejoin-session-write-failed", error);
    }
  }, [rejoinSessionKey, uid]);

  const clearRejoinIntent = useCallback(() => {
    if (!rejoinSessionKey) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(rejoinSessionKey);
    } catch (error) {
      logDebug("spectator-flow", "rejoin-session-clear-failed", error);
    }
  }, [rejoinSessionKey]);

  const hasRejoinIntent = useCallback(() => {
    if (!rejoinSessionKey || !uid) return false;
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem(rejoinSessionKey) === uid;
    } catch (error) {
      logDebug("spectator-flow", "rejoin-session-read-failed", error);
      return false;
    }
  }, [rejoinSessionKey, uid]);

  const clearAutoJoinSuppress = useCallback(() => {
    if (!autoJoinSuppressKey || !uid) return;
    clearAutoJoinSuppressFlag({
      roomId,
      uid,
      autoJoinSuppressKey,
      context: "manual",
    });
  }, [autoJoinSuppressKey, roomId, uid]);

  const suppressAutoJoinIntent = useCallback(() => {
    if (!autoJoinSuppressKey || !uid) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(autoJoinSuppressKey, "1");
    } catch (error) {
      logDebug("spectator-flow", "auto-join-suppress-failed", error);
    }
  }, [autoJoinSuppressKey, uid]);

  const markSeatRequestIntent = useCallback(
    (source: SpectatorRequestSource, canRequestNow: boolean) => {
      rememberRejoinIntent();
      clearAutoJoinSuppress();
      if (canRequestNow) {
        clearPendingSeatRequest();
      } else {
        queuePendingSeatRequest(source);
      }
    },
    [clearAutoJoinSuppress, clearPendingSeatRequest, queuePendingSeatRequest, rememberRejoinIntent]
  );

  const cancelSeatRequestSafely = useCallback(async () => {
    if (!uid) return false;
    try {
      await cancelSeatRequest(roomId, uid);
      return true;
    } catch (error) {
      logDebug("spectator-flow", "cancel-seat-request-failed", { roomId, uid, error });
      return false;
    }
  }, [roomId, uid]);

  const handleSeatRecovery = useCallback(
    async ({
      silent,
      source,
      spectatorRecallEnabled,
      roomStatus,
      recallOpen,
      notify,
      requestSeatNow,
    }: HandleSeatRecoveryOptions): Promise<boolean> => {
      if (!uid) return false;

      const canRequestNow = spectatorRecallEnabled;
      const emitSeatIntent = () => {
        setSeatRequestTimedOut(false);
        markSeatRequestIntent(source, canRequestNow);
        traceAction("spectator.request.intent", {
          roomId,
          uid,
          source,
          canRequestNow: canRequestNow ? "1" : "0",
          roomStatus,
          recallOpen,
        });
        logSpectatorRequestEnqueue({
          roomId,
          uid,
          source,
          canRequestNow,
          roomStatus,
          recallOpen,
        });
        emitSpectatorEvent({ type: "SPECTATOR_REQUEST", source });
        if (canRequestNow) {
          leavingRef.current = true;
          requestSeatNow(source);
        } else {
          leavingRef.current = false;
          logDebug("room-page", "seat-request-queued", {
            roomId,
            uid,
            source,
            roomStatus,
            recallOpen,
          });
        }
      };

      const safeNotify = (payload: NotifyPayload) => {
        try {
          notify(payload);
        } catch (error) {
          logDebug("spectator-flow", "notify-seat-recovery-failed", error);
        }
      };

      if (!spectatorRecallEnabled) {
        traceAction("spectator.request.blocked.recall", {
          roomId,
          uid,
          source,
          roomStatus,
          recallOpen,
          silent: silent ? "1" : "0",
        });
        if (!silent) {
          safeNotify({
            title:
              roomStatus === "waiting"
                ? "まだ戻れません"
                : "ゲーム進行中です",
            description:
              roomStatus === "waiting"
                ? "ホストが観戦枠を開くまで、しばらくお待ちください。"
                : "ゲームが進行中のため現在は戻れません。ホストの操作が完了するまでお待ちください。",
            type: "info",
          });
        } else {
          logDebug("room-page", "auto-seat-recovery-blocked-recall", {
            roomId,
            uid,
            source,
            roomStatus,
            recallOpen,
          });
        }
        emitSeatIntent();
        return true;
      }

      if (versionMismatchBlocksAccess) {
        traceAction("spectator.request.blocked.versionMismatch", {
          roomId,
          uid,
          source,
          roomStatus,
          silent: silent ? "1" : "0",
        });
        if (!silent) {
          safeNotify({
            title: "新しいバージョンが必要です",
            description:
              "ページを再読み込みし、最新バージョンへ更新してください。",
            type: "warning",
          });
        } else {
          logDebug("room-page", "auto-seat-recovery-blocked-version-mismatch", {
            roomId,
            uid,
            source,
            roomStatus,
          });
        }
        return false;
      }

      if (silent) {
        return false;
      }

      emitSeatIntent();
      safeNotify({
        title: "再入室リクエストを送信しました",
        description: "ホストの承認をお待ちください。",
        type: "info",
      });
      return true;
    },
    [
      uid,
      versionMismatchBlocksAccess,
      setSeatRequestTimedOut,
      markSeatRequestIntent,
      roomId,
      emitSpectatorEvent,
      leavingRef,
    ]
  );

  return useMemo(
    () => ({
      spectatorReason,
      seatRequestSource,
      seatRequestPending,
      seatRequestAccepted,
      seatRequestRejected,
      seatAcceptanceActive,
      seatRequestState,
      seatRequestButtonDisabled,
      rememberRejoinIntent,
      clearRejoinIntent,
      clearAutoJoinSuppress,
      hasRejoinIntent,
      suppressAutoJoinIntent,
      queuePendingSeatRequest,
      clearPendingSeatRequest,
      consumePendingSeatRequest,
      hasPendingSeatRequest,
      markSeatRequestIntent,
      cancelSeatRequestSafely,
      handleSeatRecovery,
    }),
    [
      clearAutoJoinSuppress,
      suppressAutoJoinIntent,
      clearRejoinIntent,
      hasRejoinIntent,
      rememberRejoinIntent,
      seatAcceptanceActive,
      seatRequestSource,
      seatRequestAccepted,
      seatRequestButtonDisabled,
      seatRequestPending,
      seatRequestRejected,
      spectatorReason,
      seatRequestState,
      queuePendingSeatRequest,
      clearPendingSeatRequest,
      consumePendingSeatRequest,
      hasPendingSeatRequest,
      markSeatRequestIntent,
      cancelSeatRequestSafely,
      handleSeatRecovery,
    ]
  );
}
