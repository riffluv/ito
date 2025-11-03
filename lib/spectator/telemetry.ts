"use client";

import type { SpectatorRequestSource } from "@/lib/state/roomMachine";
import { traceAction } from "@/lib/utils/trace";

type RoomStatus = string | null | undefined;

export function logSpectatorRequestEnqueue(detail: {
  roomId: string;
  uid: string;
  source: SpectatorRequestSource;
  canRequestNow: boolean;
  roomStatus: RoomStatus;
  recallOpen: boolean;
}): void {
  traceAction("spectator.request.enqueue", detail);
}

export function logSpectatorForceExitDetected(detail: {
  roomId: string;
  uid: string | null;
  reason: string | null;
  canAccess: boolean;
  recallOpen: boolean;
  status: RoomStatus;
}): void {
  traceAction("spectator.forceExit.detected", detail);
}

export function logSpectatorForceExitCleanup(detail: {
  roomId: string;
  uid: string | null;
  reason: string | null;
}): void {
  traceAction("spectator.forceExit.cleanup", detail);
}

export function logSpectatorForceExitRecovered(detail: {
  roomId: string;
  uid: string | null;
  status: RoomStatus;
  canAccess: boolean;
}): void {
  traceAction("spectator.forceExit.recovered", detail);
}
