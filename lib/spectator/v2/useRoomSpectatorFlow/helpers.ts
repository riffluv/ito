import type { RoomStatus } from "@/lib/state/guards";
import type {
  SpectatorReason,
  SpectatorRequestSource,
  SpectatorStatus,
} from "@/lib/state/roomMachine";
import type { SeatRequestViewState, SpectatorMachineState } from "../useSpectatorController";

export const AUTO_RECALL_MAX_ATTEMPTS = 3;
export const AUTO_RECALL_RETRY_MS = 3000;
export const SEAT_REQUEST_TIMEOUT_MS = 15_000;

export type SpectatorFsmInputs = {
  status: SpectatorStatus;
  node: SpectatorStatus;
  reason: SpectatorReason;
  requestSource: SpectatorRequestSource;
  requestStatus: SeatRequestViewState["status"];
  requestCreatedAt: number | null;
  requestFailure: string | null;
  error: string | null;
};

export function deriveIsSpectatorMode(params: {
  isMember: boolean;
  isHost: boolean;
  spectatorNode: SpectatorStatus;
}): boolean {
  return !params.isMember && !params.isHost && params.spectatorNode !== "idle";
}

export function deriveSpectatorMachineState(
  spectatorFsm: SpectatorFsmInputs
): SpectatorMachineState {
  return {
    status: spectatorFsm.status,
    node: spectatorFsm.node,
    reason: spectatorFsm.reason,
    requestSource: spectatorFsm.requestSource,
    requestStatus: spectatorFsm.requestStatus,
    requestCreatedAt: spectatorFsm.requestCreatedAt,
    requestFailure: spectatorFsm.requestFailure,
    error: spectatorFsm.error,
  };
}

export function computeSeatRequestTimeoutRemainingMs(params: {
  requestedAt: number;
  now: number;
  timeoutMs?: number;
}): number {
  const timeoutMs = params.timeoutMs ?? SEAT_REQUEST_TIMEOUT_MS;
  return Math.max(timeoutMs - (params.now - params.requestedAt), 0);
}

export function shouldNotifySeatRequestReset(params: {
  previousStatus: SeatRequestViewState["status"];
  currentStatus: SeatRequestViewState["status"];
  isSpectatorMode: boolean;
  roomStatus: RoomStatus | null;
}): boolean {
  return (
    params.previousStatus === "pending" &&
    params.currentStatus === "idle" &&
    params.isSpectatorMode &&
    params.roomStatus === "waiting"
  );
}

