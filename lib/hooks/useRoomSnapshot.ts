"use client";

import { db, firebaseEnabled } from "@/lib/firebase/client";
import { useParticipants } from "@/lib/hooks/useParticipants";
import { setMetric } from "@/lib/utils/metrics";
import { useRoomSnapshotSyncPatchListener } from "@/lib/hooks/useRoomSnapshotSyncPatchListener";
import {
  type RoomSnapshotWatchdogEpisode,
  type RoomSnapshotWatchdogTrigger,
} from "@/lib/hooks/roomSnapshotWatchdog";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ROOM_SNAPSHOT_DEFER_ENABLED,
} from "@/lib/hooks/roomSnapshotConfig";
import { useRoomSnapshotAccessHandlers, type RoomAccessErrorDetail } from "@/lib/hooks/roomSnapshotAccess";
import { useRoomSnapshotRtdbRoomSyncBus } from "@/lib/hooks/useRoomSnapshotRtdbRoomSyncBus";
import {
  useRoomSnapshotEnsureMemberHeartbeat,
  type EnsureMemberHeartbeat,
} from "@/lib/hooks/useRoomSnapshotEnsureMemberHeartbeat";
import {
  useRoomSnapshotAutoJoin,
  type RoomJoinStatus,
} from "@/lib/hooks/useRoomSnapshotAutoJoin";
import { useRoomSnapshotOpsReporting } from "@/lib/hooks/useRoomSnapshotOpsReporting";
import {
  useRoomSnapshotExternalForceRefresh,
  useRoomSnapshotExternalRestartListener,
} from "@/lib/hooks/useRoomSnapshotExternalRefreshControls";
import { useRoomSnapshotWatchdogLoop } from "@/lib/hooks/useRoomSnapshotWatchdogLoop";
import { useRoomSnapshotRoomListener } from "@/lib/hooks/useRoomSnapshotRoomListener";
import { useRoomSnapshotOptimisticPlayers } from "@/lib/hooks/useRoomSnapshotOptimisticPlayers";
import { useRoomSnapshotPrefetchedRoom } from "@/lib/hooks/useRoomSnapshotPrefetchedRoom";
import { useRoomSnapshotPermissionRecovery } from "@/lib/hooks/useRoomSnapshotPermissionRecovery";
import { useRoomSnapshotRoomIdReset } from "@/lib/hooks/useRoomSnapshotRoomIdReset";
import { useRoomSnapshotExternalControls } from "@/lib/hooks/useRoomSnapshotExternalControls";
import { useRoomSnapshotSyncState } from "@/lib/hooks/useRoomSnapshotSyncState";

export type RoomSyncHealth =
  | "initial"
  | "ok"
  | "stale"
  | "recovering"
  | "blocked"
  | "paused";

export type RoomSyncState = {
  health: RoomSyncHealth;
  /** Latest successfully received room snapshot (epoch ms). */
  lastSnapshotTs: number | null;
  /** Age of the last snapshot (ms) when stale/recovering. */
  snapshotAgeMs: number | null;
  /** Last listener error (onSnapshot error callback). */
  lastListenErrorTs: number | null;
  lastListenErrorCode: string | null;
  /** Recovery attempts within the current stale episode. */
  recoveryAttempts: number;
};

export type RoomSnapshotState = {
  room: (RoomDoc & { id: string }) | null;
  players: (PlayerDoc & { id: string })[];
  loading: boolean;
  onlineUids?: string[];
  stableOnlineUids?: string[];
  presenceReady: boolean;
  presenceDegraded: boolean;
  onlinePlayers: (PlayerDoc & { id: string })[];
  isMember: boolean;
  isHost: boolean;
  joinStatus: RoomJoinStatus;
  roomAccessError: string | null;
  roomAccessErrorDetail: RoomAccessErrorDetail | null;
  sync: RoomSyncState;
  detachNow: () => void;
  reattachPresence: () => void;
  leavingRef: React.MutableRefObject<boolean>;
};

type RoomSnapshotResumeProbe = {
  seq: number;
  at: number;
  trigger: RoomSnapshotWatchdogTrigger;
  baselineServerSnapshotAt: number | null;
  retryScheduled: boolean;
};

export function useRoomSnapshot(
  roomId: string,
  uid: string | null,
  displayName?: string | null
): RoomSnapshotState {
  const [room, setRoom] = useState<(RoomDoc & { id: string }) | null>(null);
  const roomStateRef = useRef<(RoomDoc & { id: string }) | null>(null);
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [players, setPlayers] = useState<(PlayerDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomAccessError, setRoomAccessError] = useState<string | null>(null);
  const [roomAccessErrorDetail, setRoomAccessErrorDetail] = useState<RoomAccessErrorDetail | null>(null);
  const [joinStatus, setJoinStatus] = useState<RoomJoinStatus>("idle");

  const leavingRef = useRef(false);
  const joinCompletedRef = useRef(false);
  const joinInFlightRef = useRef<Promise<unknown> | null>(null);
  const joinRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinAttemptRef = useRef(0);
  const joinLimitNotifiedRef = useRef(false);
  const ensureMemberHeartbeatRef = useRef<EnsureMemberHeartbeat | null>(null);
  const statusVersionRef = useRef<number>(0);
  const lastServerStatusVersionRef = useRef<number>(0);
  const rtdbLastEventVersionRef = useRef<number>(0);
  const rtdbLastEventKeyRef = useRef<string>("");
  const rtdbConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rtdbPendingConfirmVersionRef = useRef<number>(0);
  const forceRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const restartRoomListenerRef = useRef<((reason: string) => void) | null>(null);
  const resumeKickAtRef = useRef<number>(0);
  const resumeProbeSeqRef = useRef<number>(0);
  const resumeProbeRef = useRef<RoomSnapshotResumeProbe | null>(null);
  const resumeForceRefreshRetryTimerRef = useRef<number | null>(null);

  const syncStartAtRef = useRef<number>(Date.now());
  // Server-confirmed snapshot heartbeat only (fromCache must not be treated as success).
  const lastRoomSnapshotAtRef = useRef<number | null>(null);
  // Any room snapshot callback heartbeat (cache/server) for debugging.
  const lastRoomSnapshotAnyAtRef = useRef<number | null>(null);
  const lastRoomSnapshotWasFromCacheRef = useRef(false);
  const roomSnapshotCacheSinceRef = useRef<number | null>(null);
  const lastListenErrorAtRef = useRef<number | null>(null);
  const lastListenErrorCodeRef = useRef<string | null>(null);
  const syncEpisodeRef = useRef<RoomSnapshotWatchdogEpisode>({
    active: false,
    kind: null,
    startedAt: 0,
    lastAttemptAt: 0,
    attempts: 0,
    lastTraceAt: 0,
    hardCooldownUntil: 0,
  });

  const [syncHealth, setSyncHealth] = useState<RoomSyncHealth>("initial");
  const [syncSnapshotAgeMs, setSyncSnapshotAgeMs] = useState<number | null>(null);
  const [syncRecoveryAttempts, setSyncRecoveryAttempts] = useState(0);

  const prefetchedAppliedRef = useRef(false);
  const deferEnabled = ROOM_SNAPSHOT_DEFER_ENABLED;

  const roomAccessStateRef = useRef<{
    state: "unknown" | "checking" | "granted" | "denied";
    retryAt: number;
  }>({ state: "unknown", retryAt: 0 });
  const roomAccessCheckRef = useRef<Promise<boolean> | null>(null);
  const accessBlockNotifiedRef = useRef(false);

  // participants (players collection + RTDB presence)
  const {
    players: fetchedPlayers,
    onlineUids: effectiveOnlineUids,
    stableOnlineUids,
    presenceReady,
    presenceDegraded,
    detach,
    reattachNow,
    loading: partLoading,
  } = useParticipants(roomId, uid || null);

  const onlineUids = effectiveOnlineUids;

  const normalizedDisplayName = useMemo(() => {
    if (typeof displayName === "string") {
      const trimmed = displayName.trim();
      if (trimmed.length > 0) return trimmed;
    }
    return null;
  }, [displayName]);

  useEffect(() => {
    roomStateRef.current = room;
  }, [room]);

  const isMember = useMemo(() => players.some((p) => p.id === uid), [players, uid]);

  const enqueueCommit = useCallback(
    (task: () => void, startedAt: number | null, metricKey?: string) => {
      task();
      if (
        deferEnabled &&
        metricKey &&
        startedAt !== null &&
        typeof window !== "undefined"
      ) {
        setMetric(
          "roomSnapshot",
          metricKey,
          Math.round(performance.now() - startedAt)
        );
      }
    },
    [deferEnabled]
  );

  useRoomSnapshotPermissionRecovery({ roomAccessError });

  useEffect(() => {
    setRoomAccessError(null);
    setRoomAccessErrorDetail(null);
    accessBlockNotifiedRef.current = false;
  }, [roomId]);

  useRoomSnapshotRoomIdReset({
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
  });

  // Apply sync patches (API/RTDB) without waiting for Firestore propagation.
  useRoomSnapshotSyncPatchListener({
    roomId,
    leavingRef,
    roomStateRef,
    statusVersionRef,
    setRoom,
    enqueueCommit,
  });

  // RTDB roomSync event bus (server-issued fast notifications).
  useRoomSnapshotRtdbRoomSyncBus({
    roomId,
    leavingRef,
    lastServerStatusVersionRef,
    rtdbLastEventVersionRef,
    rtdbLastEventKeyRef,
    rtdbConfirmTimerRef,
    rtdbPendingConfirmVersionRef,
  });

  useRoomSnapshotOptimisticPlayers({
    roomId,
    leavingRef,
    fetchedPlayers,
    partLoading,
    enqueueCommit,
    setPlayers,
  });

  // loading = participants購読が完了し、かつルームスナップショットが届いたら解除
  useEffect(() => {
    setLoading(partLoading === true || roomLoaded === false);
  }, [partLoading, roomLoaded]);

  useRoomSnapshotPrefetchedRoom({
    roomId,
    currentRoomId: room?.id ?? null,
    prefetchedAppliedRef,
    enqueueCommit,
    setRoom,
    setRoomLoaded,
  });

  const clearRoomAccessErrorDetail = useCallback(() => {
    setRoomAccessErrorDetail(null);
  }, [setRoomAccessErrorDetail]);

  useRoomSnapshotRoomListener({
    roomId,
    enqueueCommit,
    setRoom,
    setRoomLoaded,
    setRoomAccessError,
    clearRoomAccessErrorDetail,
    roomAccessStateRef,
    roomAccessCheckRef,
    statusVersionRef,
    prefetchedAppliedRef,
    lastServerStatusVersionRef,
    lastRoomSnapshotAtRef,
    lastRoomSnapshotAnyAtRef,
    lastRoomSnapshotWasFromCacheRef,
    roomSnapshotCacheSinceRef,
    lastListenErrorAtRef,
    lastListenErrorCodeRef,
    syncEpisodeRef,
    setSyncHealth,
    setSyncSnapshotAgeMs,
    setSyncRecoveryAttempts,
    restartRoomListenerRef,
    resumeProbeRef,
    resumeForceRefreshRetryTimerRef,
  });

  useRoomSnapshotExternalRestartListener({
    roomId,
    leavingRef,
    restartRoomListenerRef,
  });

  useRoomSnapshotExternalForceRefresh({
    roomId,
    firestore: db ?? null,
    leavingRef,
    forceRefreshInFlightRef,
    statusVersionRef,
    lastServerStatusVersionRef,
    lastRoomSnapshotAtRef,
    lastRoomSnapshotAnyAtRef,
    lastRoomSnapshotWasFromCacheRef,
    roomSnapshotCacheSinceRef,
    lastListenErrorAtRef,
    lastListenErrorCodeRef,
    syncEpisodeRef,
    setSyncHealth,
    setSyncSnapshotAgeMs,
    setSyncRecoveryAttempts,
    setRoom,
    setRoomLoaded,
    setRoomAccessError,
    clearRoomAccessErrorDetail,
    prefetchedAppliedRef,
    resumeProbeRef,
    resumeForceRefreshRetryTimerRef,
    enqueueCommit,
  });

  const roomAccessBlocked =
    roomAccessError === "permission-denied" ||
    roomAccessError === "client-update-required" ||
    roomAccessError === "room-version-mismatch" ||
    roomAccessError === "room-version-check-failed";

  useRoomSnapshotWatchdogLoop({
    firebaseEnabled,
    roomId,
    roomAccessBlocked,
    joinStatus,
    leavingRef,
    forceRefreshInFlightRef,
    restartRoomListenerRef,
    resumeKickAtRef,
    resumeProbeSeqRef,
    resumeProbeRef,
    resumeForceRefreshRetryTimerRef,
    lastRoomSnapshotAtRef,
    lastRoomSnapshotWasFromCacheRef,
    roomSnapshotCacheSinceRef,
    lastListenErrorCodeRef,
    syncStartAtRef,
    syncEpisodeRef,
    setSyncHealth,
    setSyncSnapshotAgeMs,
    setSyncRecoveryAttempts,
  });

  const { handleRoomServiceAccessError } = useRoomSnapshotAccessHandlers({
    roomId,
    roomAccessBlocked,
    detach,
    setRoomAccessError,
    setRoomAccessErrorDetail,
    joinCompletedRef,
    joinLimitNotifiedRef,
    accessBlockNotifiedRef,
  });

  useRoomSnapshotEnsureMemberHeartbeat({
    roomId,
    uid,
    displayName,
    room,
    isMember,
    firebaseEnabled,
    roomAccessBlocked,
    leavingRef,
    ensureMemberHeartbeatRef,
    handleRoomServiceAccessError,
  });

  useRoomSnapshotAutoJoin({
    firebaseEnabled,
    uid,
    room,
    leavingRef,
    roomAccessBlocked,
    isMember,
    normalizedDisplayName,
    roomId,
    joinStatus,
    setJoinStatus,
    joinCompletedRef,
    joinInFlightRef,
    joinRetryTimerRef,
    joinAttemptRef,
    joinLimitNotifiedRef,
    handleRoomServiceAccessError,
  });

  useRoomSnapshotOpsReporting({
    roomId,
    roomStatus: room?.status ?? null,
    joinStatus,
    joinAttemptRef,
    roomAccessError,
    roomAccessErrorDetail,
    syncHealth,
    syncSnapshotAgeMs,
  });

  // isHost / onlinePlayers
  const isHost = useMemo(() => room?.hostId === uid, [room?.hostId, uid]);
  const onlinePlayers = useMemo(
    () => players.filter((p) => onlineUids?.includes(p.id)),
    [players, onlineUids]
  );

  const sync: RoomSyncState = useRoomSnapshotSyncState({
    roomAccessBlocked,
    syncHealth,
    syncSnapshotAgeMs,
    syncRecoveryAttempts,
    lastRoomSnapshotAtRef,
    lastListenErrorAtRef,
    lastListenErrorCodeRef,
  });

  const externalControls = useRoomSnapshotExternalControls({
    detachNow: detach,
    reattachPresence: reattachNow,
    leavingRef,
  });

  return {
    room,
    players,
    loading,
    onlineUids,
    stableOnlineUids,
    presenceReady,
    presenceDegraded,
    onlinePlayers,
    isMember,
    isHost,
    joinStatus,
    roomAccessError,
    roomAccessErrorDetail,
    sync,
    ...externalControls,
  };
}
