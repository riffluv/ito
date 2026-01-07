"use client";

import { useMemo, type MutableRefObject } from "react";

type RoomSyncHealth =
  | "initial"
  | "ok"
  | "stale"
  | "recovering"
  | "blocked"
  | "paused";

type RoomSyncState = {
  health: RoomSyncHealth;
  lastSnapshotTs: number | null;
  snapshotAgeMs: number | null;
  lastListenErrorTs: number | null;
  lastListenErrorCode: string | null;
  recoveryAttempts: number;
};

export function useRoomSnapshotSyncState(params: {
  roomAccessBlocked: boolean;
  syncHealth: RoomSyncHealth;
  syncSnapshotAgeMs: number | null;
  syncRecoveryAttempts: number;
  lastRoomSnapshotAtRef: MutableRefObject<number | null>;
  lastListenErrorAtRef: MutableRefObject<number | null>;
  lastListenErrorCodeRef: MutableRefObject<string | null>;
}): RoomSyncState {
  const {
    roomAccessBlocked,
    syncHealth,
    syncSnapshotAgeMs,
    syncRecoveryAttempts,
    lastRoomSnapshotAtRef,
    lastListenErrorAtRef,
    lastListenErrorCodeRef,
  } = params;

  return useMemo(
    () => ({
      health: roomAccessBlocked ? "blocked" : syncHealth,
      lastSnapshotTs: lastRoomSnapshotAtRef.current,
      snapshotAgeMs:
        syncHealth === "stale" || syncHealth === "recovering"
          ? syncSnapshotAgeMs
          : null,
      lastListenErrorTs: lastListenErrorAtRef.current,
      lastListenErrorCode: lastListenErrorCodeRef.current,
      recoveryAttempts: syncRecoveryAttempts,
    }),
    [
      lastListenErrorAtRef,
      lastListenErrorCodeRef,
      lastRoomSnapshotAtRef,
      roomAccessBlocked,
      syncHealth,
      syncRecoveryAttempts,
      syncSnapshotAgeMs,
    ]
  );
}

