import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { UseSpectatorSessionResult } from "./useSpectatorSession";
import { logSpectatorRequestEnqueue } from "@/lib/spectator/telemetry";
import { traceAction, traceError } from "@/lib/utils/trace";
import { logDebug } from "@/lib/utils/log";
import type {
  RoomMachineClientEvent,
  SpectatorReason,
  SpectatorRequestSource,
  SpectatorStatus,
} from "@/lib/state/roomMachine";
import type { RoomStatus } from "@/lib/state/guards";

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

export type SpectatorMachineState = {
  status: SpectatorStatus;
  node: SpectatorStatus;
  reason: SpectatorReason;
  requestSource: SpectatorRequestSource;
  requestStatus: "idle" | "pending" | "accepted" | "rejected";
  requestCreatedAt: number | null;
  requestFailure: string | null;
  error: string | null;
};

type SeatRequestSourceValue = Exclude<SpectatorRequestSource, null>;

type HandleSeatRecoveryOptions = {
  silent: boolean;
  source: SeatRequestSourceValue;
  spectatorRecallEnabled: boolean;
  roomStatus: RoomStatus | null;
  recallOpen: boolean;
  notify: (payload: NotifyPayload) => void;
};

export type UseSpectatorControllerParams = {
  roomId: string;
  uid: string | null;
  isSpectatorMode: boolean;
  spectatorMachineState: SpectatorMachineState;
  versionMismatchBlocksAccess: boolean;
  emitSpectatorEvent: (event: RoomMachineClientEvent) => void;
  setSeatRequestTimedOut: Dispatch<SetStateAction<boolean>>;
  leavingRef: MutableRefObject<boolean>;
  spectatorSession: UseSpectatorSessionResult;
};

export type SeatRequestViewState = {
  status: "idle" | "pending" | "accepted" | "rejected";
  source: SpectatorRequestSource | null;
  requestedAt: number | null;
  error?: string | null;
};

export type SpectatorControllerState = {
  reason: SpectatorReason | null;
  seatRequest: SeatRequestViewState;
  seatRequestPending: boolean;
  seatRequestAccepted: boolean;
  seatRequestRejected: boolean;
  seatAcceptanceActive: boolean;
  seatRequestButtonDisabled: boolean;
  seatRequestSource: SpectatorRequestSource | null;
};

export type SpectatorControllerActions = {
  rememberRejoinIntent: () => void;
  clearRejoinIntent: () => void;
  clearAutoJoinSuppress: () => void;
  suppressAutoJoinIntent: () => void;
  queuePendingSeatRequest: (source: SeatRequestSourceValue) => void;
  clearPendingSeatRequest: () => void;
  markSeatRequestIntent: (source: SeatRequestSourceValue, canRequestNow: boolean) => void;
  handleSeatRecovery: (options: HandleSeatRecoveryOptions) => Promise<boolean>;
  cancelSeatRequestSafely: () => Promise<boolean>;
};

export type SpectatorControllerUtils = {
  hasRejoinIntent: () => boolean;
  consumePendingSeatRequest: () => SeatRequestSourceValue | null;
  hasPendingSeatRequest: () => boolean;
};

export type SpectatorController = {
  state: SpectatorControllerState;
  actions: SpectatorControllerActions;
  utils: SpectatorControllerUtils;
};

const safeNotify = (notify: (payload: NotifyPayload) => void, payload: NotifyPayload) => {
  try {
    notify(payload);
  } catch (error) {
    logDebug("spectator-controller", "notify-failed", error);
  }
};

export function useSpectatorController({
  roomId,
  uid,
  isSpectatorMode,
  spectatorMachineState,
  versionMismatchBlocksAccess,
  emitSpectatorEvent,
  setSeatRequestTimedOut,
  leavingRef,
  spectatorSession,
}: UseSpectatorControllerParams): SpectatorController {
  const rejoinIntentRef = useRef(false);
  const autoJoinSuppressRef = useRef(false);
  const pendingSeatRequestRef = useRef<SeatRequestSourceValue | null>(null);
  const [lastRequestAt, setLastRequestAt] = useState<number | null>(
    spectatorMachineState.requestCreatedAt
  );

  const spectatorReason = useMemo<SpectatorReason | null>(() => {
    if (!isSpectatorMode) {
      return null;
    }
    return spectatorMachineState.reason;
  }, [isSpectatorMode, spectatorMachineState.reason]);

  useEffect(() => {
    if (!isSpectatorMode) {
      return;
    }
    emitSpectatorEvent({
      type: "SPECTATOR_REASON_UPDATE",
      reason: spectatorReason,
    });
  }, [emitSpectatorEvent, isSpectatorMode, spectatorReason]);

  const rememberRejoinIntent = useCallback(() => {
    rejoinIntentRef.current = true;
  }, []);

  const clearRejoinIntent = useCallback(() => {
    rejoinIntentRef.current = false;
  }, []);

  const hasRejoinIntent = useCallback(() => rejoinIntentRef.current, []);

  const clearAutoJoinSuppress = useCallback(() => {
    autoJoinSuppressRef.current = false;
  }, []);

  const suppressAutoJoinIntent = useCallback(() => {
    autoJoinSuppressRef.current = true;
  }, []);

  const queuePendingSeatRequest = useCallback((source: SeatRequestSourceValue) => {
    pendingSeatRequestRef.current = source;
  }, []);

  const clearPendingSeatRequest = useCallback(() => {
    pendingSeatRequestRef.current = null;
  }, []);

  const consumePendingSeatRequest = useCallback((): SeatRequestSourceValue | null => {
    const current = pendingSeatRequestRef.current;
    pendingSeatRequestRef.current = null;
    return current;
  }, []);

  const hasPendingSeatRequest = useCallback(() => pendingSeatRequestRef.current !== null, []);

  const markSeatRequestIntent = useCallback(
    (source: SeatRequestSourceValue, canRequestNow: boolean) => {
      rememberRejoinIntent();
      clearAutoJoinSuppress();
      if (canRequestNow) {
        clearPendingSeatRequest();
      } else {
        queuePendingSeatRequest(source);
      }
    },
    [rememberRejoinIntent, clearAutoJoinSuppress, clearPendingSeatRequest, queuePendingSeatRequest]
  );

  const cancelSeatRequestSafely = useCallback(async () => {
    if (!uid) {
      return false;
    }
    const sessionId = spectatorSession.sessionId;
    if (!sessionId) {
      return false;
    }
    try {
      await spectatorSession.actions.cancelRejoin(sessionId);
      clearPendingSeatRequest();
      clearRejoinIntent();
      leavingRef.current = false;
      return true;
    } catch (error) {
      traceError("spectator.cancelRejoin.failed", error, {
        roomId,
        uid,
        sessionId,
      });
      return false;
    }
  }, [uid, spectatorSession.actions, spectatorSession.sessionId, clearPendingSeatRequest, clearRejoinIntent, leavingRef, roomId]);

  useEffect(() => {
    if (spectatorSession.status !== "rejoinPending") {
      leavingRef.current = false;
    }
  }, [leavingRef, spectatorSession.status]);

  const seatRequestError = useMemo(() => {
    if (spectatorSession.status === "rejoinRejected") {
      const snapshot = spectatorSession.rejoinSnapshot;
      const rejectionReason =
        snapshot && snapshot.status === "rejected" ? snapshot.reason ?? null : null;
      return (
        rejectionReason ??
        spectatorSession.error ??
        spectatorMachineState.requestFailure ??
        spectatorMachineState.error ??
        null
      );
    }
    return (
      spectatorSession.error ??
      spectatorMachineState.error ??
      spectatorMachineState.requestFailure ??
      null
    );
  }, [
    spectatorMachineState.error,
    spectatorMachineState.requestFailure,
    spectatorSession.error,
    spectatorSession.rejoinSnapshot,
    spectatorSession.status,
  ]);

  const seatRequestState = useMemo<SeatRequestViewState>(() => {
    let status: SeatRequestViewState["status"] = "idle";
    if (spectatorSession.status === "rejoinPending") {
      status = "pending";
    } else if (spectatorSession.status === "rejoinApproved") {
      status = "accepted";
    } else if (spectatorSession.status === "rejoinRejected") {
      status = "rejected";
    }

    const snapshot = spectatorSession.rejoinSnapshot;
    const source = snapshot?.source ?? pendingSeatRequestRef.current ?? spectatorMachineState.requestSource ?? null;
    const requestedAt = snapshot?.createdAt ?? spectatorMachineState.requestCreatedAt ?? lastRequestAt;

    return {
      status,
      source,
      requestedAt,
      error: seatRequestError,
    };
  }, [
    spectatorSession.status,
    spectatorSession.rejoinSnapshot,
    spectatorMachineState.requestSource,
    spectatorMachineState.requestCreatedAt,
    seatRequestError,
    lastRequestAt,
  ]);

  const handleSeatRecovery = useCallback(
    async ({
      silent,
      source,
      spectatorRecallEnabled,
      roomStatus,
      recallOpen,
      notify,
    }: HandleSeatRecoveryOptions) => {
      if (!uid) {
        return false;
      }
      const sessionId = spectatorSession.sessionId;
      if (!sessionId) {
        if (!silent) {
          safeNotify(notify, {
            title: "観戦セッションを確認できません",
            description: "ページを再読み込みしてから再度お試しください。",
            type: "error",
          });
        }
        return false;
      }

      const canRequestNow = spectatorRecallEnabled;

      markSeatRequestIntent(source, canRequestNow);
      setSeatRequestTimedOut(false);

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

      if (!spectatorRecallEnabled) {
        if (!silent) {
          safeNotify(notify, {
            title:
              roomStatus === "waiting" ? "まだ戻れません" : "ゲーム進行中です",
            description:
              roomStatus === "waiting"
                ? "ホストが観戦枠を開くまで、しばらくお待ちください。"
                : "ゲームが進行中のため現在は戻れません。ホストの操作が完了するまでお待ちください。",
            type: "info",
          });
        } else {
          logDebug("spectator-controller", "seat-request-queued", {
            roomId,
            uid,
            source,
            roomStatus,
            recallOpen,
          });
        }
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
          safeNotify(notify, {
            title: "新しいバージョンが必要です",
            description: "ページを再読み込みして最新バージョンに更新してください。",
            type: "warning",
          });
        }
        return false;
      }

      leavingRef.current = true;

      try {
        spectatorSession.actions.requestRejoin(source);
        setLastRequestAt(Date.now());
        if (!silent) {
          safeNotify(notify, {
            title: "再入室リクエストを送信しました",
            description: "ホストの承認をお待ちください。",
            type: "info",
          });
        }
        return true;
      } catch (error) {
        leavingRef.current = false;
        queuePendingSeatRequest(source);
        clearRejoinIntent();
        traceError("spectator.requestRejoin.failed", error, {
          roomId,
          uid,
          sessionId,
        });
        emitSpectatorEvent({
          type: "SPECTATOR_ERROR",
          error:
            error instanceof Error ? error.message : typeof error === "string" ? error : "unknown",
        });
        if (!silent) {
          safeNotify(notify, {
            title: "リクエストに失敗しました",
            description: "通信状況を確認してから再度お試しください。",
            type: "error",
          });
        }
        return false;
      }
    },
    [
      uid,
      spectatorSession.actions,
      spectatorSession.sessionId,
      markSeatRequestIntent,
      setSeatRequestTimedOut,
      roomId,
      emitSpectatorEvent,
      queuePendingSeatRequest,
      clearRejoinIntent,
      versionMismatchBlocksAccess,
      leavingRef,
    ]
  );

  const seatRequestPending = seatRequestState.status === "pending";
  const seatRequestAccepted = seatRequestState.status === "accepted";
  const seatRequestRejected = seatRequestState.status === "rejected";
  const seatAcceptanceActive = seatRequestAccepted;

  const seatRequestButtonDisabled =
    versionMismatchBlocksAccess ||
    seatRequestPending ||
    seatAcceptanceActive ||
    !spectatorSession.sessionId;

  const state: SpectatorControllerState = useMemo(
    () => ({
      reason: spectatorReason,
      seatRequest: seatRequestState,
      seatRequestPending,
      seatRequestAccepted,
      seatRequestRejected,
      seatAcceptanceActive,
      seatRequestButtonDisabled,
      seatRequestSource: seatRequestState.source,
    }),
    [
      seatRequestState,
      seatRequestPending,
      seatRequestAccepted,
      seatRequestRejected,
      seatAcceptanceActive,
      seatRequestButtonDisabled,
      spectatorReason,
    ]
  );

  const actions: SpectatorControllerActions = useMemo(
    () => ({
      rememberRejoinIntent,
      clearRejoinIntent,
      clearAutoJoinSuppress,
      suppressAutoJoinIntent,
      queuePendingSeatRequest,
      clearPendingSeatRequest,
      markSeatRequestIntent,
      handleSeatRecovery,
      cancelSeatRequestSafely,
    }),
    [
      rememberRejoinIntent,
      clearRejoinIntent,
      clearAutoJoinSuppress,
      suppressAutoJoinIntent,
      queuePendingSeatRequest,
      clearPendingSeatRequest,
      markSeatRequestIntent,
      handleSeatRecovery,
      cancelSeatRequestSafely,
    ]
  );

  const utils: SpectatorControllerUtils = useMemo(
    () => ({
      hasRejoinIntent,
      consumePendingSeatRequest,
      hasPendingSeatRequest,
    }),
    [hasRejoinIntent, consumePendingSeatRequest, hasPendingSeatRequest]
  );

  return { state, actions, utils };
}
