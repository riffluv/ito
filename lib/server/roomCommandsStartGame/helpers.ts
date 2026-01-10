import type { RoomDoc } from "@/lib/types";

export function normalizeStartGameFlags(params: {
  allowFromFinished?: boolean;
  allowFromClue?: boolean;
  autoDeal?: boolean;
}): {
  allowFromFinished: boolean;
  allowFromClue: boolean;
  doAutoDeal: boolean;
} {
  return {
    allowFromFinished: params.allowFromFinished ?? false,
    allowFromClue: params.allowFromClue ?? false,
    doAutoDeal: params.autoDeal === true,
  };
}

export function buildStartLockHolder(requestId: string): string {
  return `start:${requestId}`;
}

export function buildStartLockedTrace(params: {
  roomId: string;
  requestId: string;
  holder: string;
}) {
  return {
    roomId: params.roomId,
    requestId: params.requestId,
    holder: params.holder,
  };
}

export function buildStartRoundPreparingUpdate(params: {
  fieldServerTimestamp: unknown;
}): { "ui.roundPreparing": true; lastActiveAt: unknown } {
  return {
    "ui.roundPreparing": true,
    lastActiveAt: params.fieldServerTimestamp,
  };
}

export function buildStartFailureTrace(params: {
  roomId: string;
  requestId: string;
  prevStatus: RoomDoc["status"] | null;
  failureRoom: RoomDoc | undefined;
  locked: boolean;
}) {
  return {
    roomId: params.roomId,
    requestId: params.requestId,
    prevStatus: params.prevStatus,
    status: params.failureRoom?.status ?? null,
    roundPreparing: params.failureRoom?.ui?.roundPreparing ?? null,
    startRequestId: params.failureRoom?.startRequestId ?? null,
    locked: params.locked ? "1" : "0",
  };
}

