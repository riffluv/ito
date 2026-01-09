import type { SpectatorReason, SpectatorRequestSource } from "@/lib/state/roomMachine";
import type { SpectatorRejoinSnapshot, SpectatorSessionContext } from "../types";
import type { SeatRequestViewState } from "../useSpectatorController";

export function deriveSeatRequestError(params: {
  spectatorSessionStatus: SpectatorSessionContext["status"];
  spectatorSessionError: string | null;
  spectatorSessionRejoinSnapshot: SpectatorRejoinSnapshot;
  spectatorMachineError: string | null;
  spectatorMachineRequestFailure: string | null;
}): string | null {
  if (params.spectatorSessionStatus === "rejoinRejected") {
    const snapshot = params.spectatorSessionRejoinSnapshot;
    const rejectionReason =
      snapshot && snapshot.status === "rejected" ? snapshot.reason ?? null : null;
    return (
      rejectionReason ??
      params.spectatorSessionError ??
      params.spectatorMachineRequestFailure ??
      params.spectatorMachineError ??
      null
    );
  }
  return (
    params.spectatorSessionError ??
    params.spectatorMachineError ??
    params.spectatorMachineRequestFailure ??
    null
  );
}

export function deriveSeatRequestViewState(params: {
  spectatorSessionStatus: SpectatorSessionContext["status"];
  spectatorSessionRejoinSnapshot: SpectatorRejoinSnapshot;
  spectatorMachineRequestSource: SpectatorRequestSource | null;
  spectatorMachineRequestCreatedAt: number | null;
  pendingSeatRequest: SpectatorRequestSource | null;
  lastRequestAt: number | null;
  seatRequestError: string | null;
}): SeatRequestViewState {
  const {
    spectatorSessionStatus,
    spectatorSessionRejoinSnapshot,
    spectatorMachineRequestSource,
    spectatorMachineRequestCreatedAt,
    pendingSeatRequest,
    lastRequestAt,
    seatRequestError,
  } = params;

  let status: SeatRequestViewState["status"] = "idle";
  if (spectatorSessionStatus === "rejoinPending") {
    status = "pending";
  } else if (spectatorSessionStatus === "rejoinApproved") {
    status = "accepted";
  } else if (spectatorSessionStatus === "rejoinRejected") {
    status = "rejected";
  }

  const snapshot = spectatorSessionRejoinSnapshot;
  const source =
    snapshot?.source ?? pendingSeatRequest ?? spectatorMachineRequestSource ?? null;
  const requestedAt =
    snapshot?.createdAt ?? spectatorMachineRequestCreatedAt ?? lastRequestAt;

  return {
    status,
    source,
    requestedAt,
    error: seatRequestError,
  };
}

export function deriveSeatRequestButtonDisabled(params: {
  versionMismatchBlocksAccess: boolean;
  seatRequestPending: boolean;
  seatAcceptanceActive: boolean;
  spectatorSessionId: string | null;
}): boolean {
  return (
    params.versionMismatchBlocksAccess ||
    params.seatRequestPending ||
    params.seatAcceptanceActive ||
    !params.spectatorSessionId
  );
}

export function deriveSpectatorReason(params: {
  isSpectatorMode: boolean;
  spectatorMachineStateReason: SpectatorReason;
}): SpectatorReason | null {
  if (!params.isSpectatorMode) return null;
  return params.spectatorMachineStateReason;
}
