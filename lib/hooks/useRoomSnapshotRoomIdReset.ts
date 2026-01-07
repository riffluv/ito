"use client";

import type {
  RoomSnapshotWatchdogEpisode,
  RoomSnapshotWatchdogTrigger,
} from "@/lib/hooks/roomSnapshotWatchdog";
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

type RoomSyncHealth =
  | "initial"
  | "ok"
  | "stale"
  | "recovering"
  | "blocked"
  | "paused";

type RoomSnapshotResumeProbe = {
  seq: number;
  at: number;
  trigger: RoomSnapshotWatchdogTrigger;
  baselineServerSnapshotAt: number | null;
  retryScheduled: boolean;
};

export function useRoomSnapshotRoomIdReset(params: {
  roomId: string;
  syncStartAtRef: MutableRefObject<number>;
  lastRoomSnapshotAtRef: MutableRefObject<number | null>;
  lastRoomSnapshotAnyAtRef: MutableRefObject<number | null>;
  lastRoomSnapshotWasFromCacheRef: MutableRefObject<boolean>;
  roomSnapshotCacheSinceRef: MutableRefObject<number | null>;
  lastListenErrorAtRef: MutableRefObject<number | null>;
  lastListenErrorCodeRef: MutableRefObject<string | null>;
  lastServerStatusVersionRef: MutableRefObject<number>;
  rtdbLastEventVersionRef: MutableRefObject<number>;
  rtdbLastEventKeyRef: MutableRefObject<string>;
  rtdbConfirmTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  rtdbPendingConfirmVersionRef: MutableRefObject<number>;
  resumeProbeRef: MutableRefObject<RoomSnapshotResumeProbe | null>;
  resumeProbeSeqRef: MutableRefObject<number>;
  resumeForceRefreshRetryTimerRef: MutableRefObject<number | null>;
  syncEpisodeRef: MutableRefObject<RoomSnapshotWatchdogEpisode>;
  setSyncHealth: Dispatch<SetStateAction<RoomSyncHealth>>;
  setSyncSnapshotAgeMs: Dispatch<SetStateAction<number | null>>;
  setSyncRecoveryAttempts: Dispatch<SetStateAction<number>>;
}) {
  const {
    roomId,
    syncStartAtRef,
    lastRoomSnapshotAtRef,
    lastRoomSnapshotAnyAtRef,
    lastRoomSnapshotWasFromCacheRef,
    roomSnapshotCacheSinceRef,
    lastListenErrorAtRef,
    lastListenErrorCodeRef,
    lastServerStatusVersionRef,
    rtdbLastEventVersionRef,
    rtdbLastEventKeyRef,
    rtdbConfirmTimerRef,
    rtdbPendingConfirmVersionRef,
    resumeProbeRef,
    resumeProbeSeqRef,
    resumeForceRefreshRetryTimerRef,
    syncEpisodeRef,
    setSyncHealth,
    setSyncSnapshotAgeMs,
    setSyncRecoveryAttempts,
  } = params;

  useEffect(() => {
    syncStartAtRef.current = Date.now();
    lastRoomSnapshotAtRef.current = null;
    lastRoomSnapshotAnyAtRef.current = null;
    lastRoomSnapshotWasFromCacheRef.current = false;
    roomSnapshotCacheSinceRef.current = null;
    lastListenErrorAtRef.current = null;
    lastListenErrorCodeRef.current = null;
    lastServerStatusVersionRef.current = 0;
    rtdbLastEventVersionRef.current = 0;
    rtdbLastEventKeyRef.current = "";
    rtdbPendingConfirmVersionRef.current = 0;
    if (rtdbConfirmTimerRef.current !== null) {
      clearTimeout(rtdbConfirmTimerRef.current);
      rtdbConfirmTimerRef.current = null;
    }
    resumeProbeRef.current = null;
    resumeProbeSeqRef.current = 0;
    if (resumeForceRefreshRetryTimerRef.current !== null) {
      clearTimeout(resumeForceRefreshRetryTimerRef.current);
      resumeForceRefreshRetryTimerRef.current = null;
    }
    syncEpisodeRef.current = {
      active: false,
      kind: null,
      startedAt: 0,
      lastAttemptAt: 0,
      attempts: 0,
      lastTraceAt: 0,
      hardCooldownUntil: 0,
    };
    setSyncHealth("initial");
    setSyncSnapshotAgeMs(null);
    setSyncRecoveryAttempts(0);
  }, [
    lastListenErrorAtRef,
    lastListenErrorCodeRef,
    lastRoomSnapshotAnyAtRef,
    lastRoomSnapshotAtRef,
    lastRoomSnapshotWasFromCacheRef,
    lastServerStatusVersionRef,
    resumeForceRefreshRetryTimerRef,
    resumeProbeRef,
    resumeProbeSeqRef,
    roomId,
    roomSnapshotCacheSinceRef,
    rtdbConfirmTimerRef,
    rtdbLastEventKeyRef,
    rtdbLastEventVersionRef,
    rtdbPendingConfirmVersionRef,
    setSyncHealth,
    setSyncRecoveryAttempts,
    setSyncSnapshotAgeMs,
    syncEpisodeRef,
    syncStartAtRef,
  ]);
}

