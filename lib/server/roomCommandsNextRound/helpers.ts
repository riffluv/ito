import type { RoomDoc } from "@/lib/types";

export const NEXT_ROUND_ALLOWED_STATUSES: RoomDoc["status"][] = [
  "reveal",
  "finished",
  "waiting",
  "clue",
];

export function isAllowedNextRoundStatus(status: RoomDoc["status"] | null | undefined): boolean {
  if (!status) return true;
  return NEXT_ROUND_ALLOWED_STATUSES.includes(status);
}

export function isIdempotentNextRound(params: {
  nextRequestId: string | null | undefined;
  requestId: string;
  status: RoomDoc["status"] | null | undefined;
}): boolean {
  return !!params.nextRequestId && params.nextRequestId === params.requestId && params.status === "clue";
}

export function shouldRateLimit(params: {
  lastCommandMs: number | null;
  nowMs: number;
  rateLimitMs: number;
}): boolean {
  if (params.lastCommandMs === null) return false;
  return params.nowMs - params.lastCommandMs < params.rateLimitMs;
}

export function buildNextLockHolder(requestId: string): string {
  return `next:${requestId}`;
}

export function buildNextLockedTrace(params: { roomId: string; requestId: string; holder: string }) {
  return { roomId: params.roomId, requestId: params.requestId, holder: params.holder };
}

export function buildNextFailureTrace(params: {
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
    nextRequestId: params.failureRoom?.nextRequestId ?? null,
    locked: params.locked ? "1" : "0",
  };
}

