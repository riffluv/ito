import { useMemo } from "react";

import {
  useSpectatorFlow,
  type UseSpectatorFlowResult,
} from "@/lib/hooks/useSpectatorFlow";
import type { SpectatorReason } from "@/lib/state/roomMachine";

type UseSpectatorControllerParams = Parameters<typeof useSpectatorFlow>[0];

export type SpectatorControllerState = {
  reason: SpectatorReason | null;
  seatRequest: UseSpectatorFlowResult["seatRequestState"];
  seatRequestPending: boolean;
  seatRequestAccepted: boolean;
  seatRequestRejected: boolean;
  seatAcceptanceActive: boolean;
  seatRequestButtonDisabled: boolean;
  seatRequestSource: UseSpectatorFlowResult["seatRequestSource"];
};

export type SpectatorControllerActions = Pick<
  UseSpectatorFlowResult,
  | "rememberRejoinIntent"
  | "clearRejoinIntent"
  | "clearAutoJoinSuppress"
  | "suppressAutoJoinIntent"
  | "queuePendingSeatRequest"
  | "clearPendingSeatRequest"
  | "markSeatRequestIntent"
  | "handleSeatRecovery"
  | "cancelSeatRequestSafely"
>;

export type SpectatorControllerUtils = Pick<
  UseSpectatorFlowResult,
  | "hasRejoinIntent"
  | "consumePendingSeatRequest"
  | "hasPendingSeatRequest"
>;

export type SpectatorController = {
  state: SpectatorControllerState;
  actions: SpectatorControllerActions;
  utils: SpectatorControllerUtils;
};

export function useSpectatorController(
  params: UseSpectatorControllerParams
): SpectatorController {
  const flow = useSpectatorFlow(params);

  const state: SpectatorControllerState = useMemo(
    () => ({
      reason: flow.spectatorReason,
      seatRequest: flow.seatRequestState,
      seatRequestPending: flow.seatRequestPending,
      seatRequestAccepted: flow.seatRequestAccepted,
      seatRequestRejected: flow.seatRequestRejected,
      seatAcceptanceActive: flow.seatAcceptanceActive,
      seatRequestButtonDisabled: flow.seatRequestButtonDisabled,
      seatRequestSource: flow.seatRequestSource,
    }),
    [flow]
  );

  const actions: SpectatorControllerActions = useMemo(
    () => ({
      rememberRejoinIntent: flow.rememberRejoinIntent,
      clearRejoinIntent: flow.clearRejoinIntent,
      clearAutoJoinSuppress: flow.clearAutoJoinSuppress,
      suppressAutoJoinIntent: flow.suppressAutoJoinIntent,
      queuePendingSeatRequest: flow.queuePendingSeatRequest,
      clearPendingSeatRequest: flow.clearPendingSeatRequest,
      markSeatRequestIntent: flow.markSeatRequestIntent,
      handleSeatRecovery: flow.handleSeatRecovery,
      cancelSeatRequestSafely: flow.cancelSeatRequestSafely,
    }),
    [flow]
  );

  const utils: SpectatorControllerUtils = useMemo(
    () => ({
      hasRejoinIntent: flow.hasRejoinIntent,
      consumePendingSeatRequest: flow.consumePendingSeatRequest,
      hasPendingSeatRequest: flow.hasPendingSeatRequest,
    }),
    [flow]
  );

  return { state, actions, utils };
}
