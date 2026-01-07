"use client";

import { db, firebaseEnabled } from "@/lib/firebase/client";
import { ensureAuthSession } from "@/lib/firebase/authSession";
import { notify } from "@/components/ui/notify";
import { notifyPermissionRecovery } from "@/lib/firebase/permissionGuard";
import { useParticipants } from "@/lib/hooks/useParticipants";
import {
  getRoomServiceErrorCode,
  RoomServiceError,
} from "@/lib/services/roomService";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { applyRoomSyncPatch } from "@/lib/sync/applyRoomSyncPatch";
import { parseRoomSyncPatch } from "@/lib/sync/roomSyncPatch";
import {
  type RoomSnapshotWatchdogEpisode,
  type RoomSnapshotWatchdogTrigger,
} from "@/lib/hooks/roomSnapshotWatchdog";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { APP_VERSION } from "@/lib/constants/appVersion";
import deepEqual from "fast-deep-equal/es6";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { unstable_batchedUpdates } from "react-dom";
import {
  loadPrefetchedRoom,
  storePrefetchedRoom,
} from "@/lib/prefetch/prefetchRoomExperience";
import {
  applyPlayerPatch,
  mergePlayersWithOptimisticPatches,
  PLAYER_OPTIMISTIC_PATCH_EVENT,
  type OptimisticPlayerPatchEntry,
  type PlayerOptimisticPatchEventDetail,
} from "@/lib/hooks/roomSnapshotOptimisticPatches";
import {
  ROOM_SNAPSHOT_DEFER_ENABLED,
} from "@/lib/hooks/roomSnapshotConfig";
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

export type RoomAccessErrorDetail =
  | {
      kind: "version-mismatch";
      mismatchType: "client_outdated" | "room_outdated" | "unknown";
      roomVersion: string | null;
      clientVersion: string | null;
      serverVersion: string | null;
      source: "join" | "ensureMember";
    }
  | {
      kind: "version-check-failed";
      detail: string;
      source: "join" | "ensureMember";
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
  const optimisticPlayerPatchesRef = useRef<Record<string, OptimisticPlayerPatchEntry>>({});

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
  const prevRoomAccessErrorRef = useRef<string | null>(null);
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

  useEffect(() => {
    if (roomAccessError === "permission-denied") {
      if (prevRoomAccessErrorRef.current !== "permission-denied") {
        notifyPermissionRecovery("start", "ルームとの同期");
      }
      ensureAuthSession("room-access-denied").catch(() => void 0);
    } else if (
      prevRoomAccessErrorRef.current === "permission-denied" &&
      roomAccessError === null
    ) {
      notifyPermissionRecovery("success", "ルームとの同期");
    }
    prevRoomAccessErrorRef.current = roomAccessError;
  }, [roomAccessError]);

  useEffect(() => {
    setRoomAccessError(null);
    setRoomAccessErrorDetail(null);
    accessBlockNotifiedRef.current = false;
  }, [roomId]);

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
  }, [roomId]);

  // Apply sync patches (API/RTDB) without waiting for Firestore propagation.
  useEffect(() => {
    if (typeof window === "undefined") return () => undefined;
    if (!roomId) return () => undefined;

    const handler = (event: Event) => {
      if (leavingRef.current) return;
      const patch = parseRoomSyncPatch((event as CustomEvent).detail);
      if (!patch || patch.roomId !== roomId) return;

      const startedAt = typeof performance !== "undefined" ? performance.now() : null;
      const result = applyRoomSyncPatch(roomStateRef.current, patch);
      enqueueCommit(() => {
        if (!result.applied) {
          setMetric(
            "roomSnapshot",
            "patch.lastIgnored",
            `${result.reason}@${patch.meta.source}:${patch.statusVersion}`
          );
          return;
        }

        statusVersionRef.current = patch.statusVersion;
        roomStateRef.current = result.next;
        setRoom(result.next);

        setMetric("roomSnapshot", "patch.lastSource", patch.meta.source);
        setMetric("roomSnapshot", "patch.lastStatusVersion", patch.statusVersion);
        if (typeof patch.meta.ts === "number" && Number.isFinite(patch.meta.ts)) {
          setMetric("roomSnapshot", "patch.lastTs", patch.meta.ts);
        }
        if (typeof patch.meta.requestId === "string" && patch.meta.requestId.trim().length > 0) {
          setMetric("roomSnapshot", "patch.lastRequestId", patch.meta.requestId);
        }
        try {
          traceAction("room.sync.patch.apply", {
            source: patch.meta.source,
            roomId,
            statusVersion: String(patch.statusVersion),
            status: patch.room.status ?? undefined,
            command: patch.meta.command ?? undefined,
            requestId: patch.meta.requestId ?? undefined,
          });
        } catch {}
        try {
          const { id: _ignored, ...toStore } = result.next;
          storePrefetchedRoom(roomId, toStore as unknown as Record<string, unknown>);
        } catch {}
      }, startedAt, "syncPatchCommitMs");
    };

    window.addEventListener("ito:room-sync-patch", handler as EventListener);
    return () => {
      window.removeEventListener("ito:room-sync-patch", handler as EventListener);
    };
  }, [roomId, enqueueCommit]);

  // Optimistic player patches (e.g. clue submit) to avoid waiting for server propagation.
  useEffect(() => {
    if (typeof window === "undefined") return () => undefined;
    if (!roomId) return () => undefined;

    const handler = (event: Event) => {
      if (leavingRef.current) return;
      const detail = (event as CustomEvent<PlayerOptimisticPatchEventDetail>).detail;
      if (!detail || typeof detail !== "object") return;
      if (detail.roomId !== roomId) return;
      if (typeof detail.playerId !== "string" || detail.playerId.trim().length === 0) return;
      if (detail.op !== "apply" && detail.op !== "rollback") return;
      if (typeof detail.seq !== "number" || !Number.isFinite(detail.seq)) return;

      const playerId = detail.playerId;
      const reason =
        typeof detail.reason === "string" && detail.reason.trim().length > 0
          ? detail.reason.trim().slice(0, 80)
          : "unknown";
      const now = Date.now();

      if (detail.op === "apply") {
        const patch = (detail.patch ?? {}) as Partial<Pick<PlayerDoc, "clue1" | "ready">>;
        const prev = (detail.prev ?? {}) as Partial<Pick<PlayerDoc, "clue1" | "ready">>;
        optimisticPlayerPatchesRef.current[playerId] = {
          seq: detail.seq,
          reason,
          appliedAt: now,
          patch,
          prev,
        };
        enqueueCommit(() => {
          setPlayers((prevPlayers) => applyPlayerPatch(prevPlayers, playerId, patch));
        }, typeof performance !== "undefined" ? performance.now() : null, "participantsOptimisticCommitMs");
        try {
          traceAction("clue.optimistic.apply", {
            roomId,
            playerId,
            seq: String(detail.seq),
            reason,
          });
        } catch {}
        try {
          setMetric("participants", "optimistic.lastApply", `${reason}:${playerId}:${detail.seq}`);
        } catch {}
        return;
      }

      const existing = optimisticPlayerPatchesRef.current[playerId];
      if (!existing || existing.seq !== detail.seq) {
        return;
      }
      const rollbackPatch = existing.prev;
      delete optimisticPlayerPatchesRef.current[playerId];
      enqueueCommit(() => {
        setPlayers((prevPlayers) => applyPlayerPatch(prevPlayers, playerId, rollbackPatch));
      }, typeof performance !== "undefined" ? performance.now() : null, "participantsOptimisticCommitMs");
      try {
        traceAction("clue.optimistic.rollback", {
          roomId,
          playerId,
          seq: String(detail.seq),
          reason,
        });
      } catch {}
      try {
        setMetric("participants", "optimistic.lastRollback", `${reason}:${playerId}:${detail.seq}`);
      } catch {}
    };

    window.addEventListener(PLAYER_OPTIMISTIC_PATCH_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(PLAYER_OPTIMISTIC_PATCH_EVENT, handler as EventListener);
    };
  }, [roomId, enqueueCommit]);

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

  useEffect(() => {
    // Confirm optimistic patches when Firestore catches up.
    const patches = optimisticPlayerPatchesRef.current;
    const patchIds = Object.keys(patches);
    if (patchIds.length > 0) {
      for (const playerId of patchIds) {
        const entry = patches[playerId];
        if (!entry) continue;
        const player = fetchedPlayers.find((p) => p.id === playerId);
        if (!player) continue;
        const patchClue =
          typeof entry.patch.clue1 === "string" ? entry.patch.clue1 : undefined;
        const patchReady =
          typeof entry.patch.ready === "boolean" ? entry.patch.ready : undefined;
        const clueOk = patchClue === undefined || player.clue1 === patchClue;
        const readyOk = patchReady === undefined || player.ready === patchReady;
        if (clueOk && readyOk) {
          const confirmMs = Math.max(0, Date.now() - entry.appliedAt);
          delete patches[playerId];
          try {
            setMetric("participants", "optimistic.confirmMs", confirmMs);
            setMetric("participants", "optimistic.confirmReason", entry.reason);
          } catch {}
          try {
            traceAction("clue.optimistic.confirm", {
              roomId,
              playerId,
              seq: String(entry.seq),
              reason: entry.reason,
              confirmMs: String(confirmMs),
            });
          } catch {}
        }
      }
    }

    const mergedPlayers = mergePlayersWithOptimisticPatches(
      fetchedPlayers,
      optimisticPlayerPatchesRef.current
    );
    const startedAt = typeof performance !== "undefined" ? performance.now() : null;
    enqueueCommit(() => {
      unstable_batchedUpdates(() => {
        setPlayers((prev) => (deepEqual(prev, mergedPlayers) ? prev : mergedPlayers));
      });
    }, startedAt, "participantsCommitMs");
  }, [fetchedPlayers, partLoading, enqueueCommit, roomId]);

  // loading = participants購読が完了し、かつルームスナップショットが届いたら解除
  useEffect(() => {
    setLoading(partLoading === true || roomLoaded === false);
  }, [partLoading, roomLoaded]);

  // Apply prefetched room
  useEffect(() => {
    if (!roomId || typeof window === "undefined") {
      prefetchedAppliedRef.current = false;
      return;
    }
    const cached = loadPrefetchedRoom(roomId);
    if (!cached) {
      prefetchedAppliedRef.current = false;
      return;
    }
    if (room?.id === roomId) {
      return;
    }
    prefetchedAppliedRef.current = true;
    const startedAt = typeof performance !== "undefined" ? performance.now() : null;
    enqueueCommit(() => {
      prefetchedAppliedRef.current = true;
      setRoom({ id: roomId, ...(cached as RoomDoc) });
      setRoomLoaded(true);
    }, startedAt);
  }, [roomId, room?.id, enqueueCommit]);

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

  const applyRoomAccessBlock = useCallback(
    (
      nextError: "client-update-required" | "room-version-mismatch" | "room-version-check-failed",
      detail: RoomAccessErrorDetail
    ) => {
      if (roomAccessBlocked) return;
      traceAction("room.access.denied", { roomId, code: nextError });
      setRoomAccessError(nextError);
      setRoomAccessErrorDetail(detail);
      joinCompletedRef.current = true;
      joinLimitNotifiedRef.current = true;
      try {
        detach();
      } catch {}

      if (accessBlockNotifiedRef.current) return;
      accessBlockNotifiedRef.current = true;

      if (nextError === "client-update-required" && detail.kind === "version-mismatch") {
        notify({
          title: "アップデートが必要です",
          description:
            `この部屋はバージョン ${detail.roomVersion ?? "不明"} で進行中です。` +
            `現在のバージョン (${detail.clientVersion ?? APP_VERSION}) では参加できません。` +
            "ページを更新して最新バージョンでお試しください。",
          type: "error",
        });
        return;
      }

      if (nextError === "room-version-mismatch" && detail.kind === "version-mismatch") {
        notify({
          title: "この部屋は別バージョンです",
          description:
            `この部屋はバージョン ${detail.roomVersion ?? "不明"} で進行中です。` +
            `現在のバージョン (${detail.clientVersion ?? APP_VERSION}) からは参加・操作できません。` +
            "更新してもこの部屋には入れないため、新しい部屋を作成するか招待を取り直してください。",
          type: "error",
        });
        return;
      }

      if (nextError === "room-version-check-failed" && detail.kind === "version-check-failed") {
        notify({
          title: "バージョン確認に失敗しました",
          description: "ページを更新してから、もう一度入室をお試しください。",
          type: "error",
        });
      }
    },
    [roomAccessBlocked, roomId, detach]
  );

  const handleRoomServiceAccessError = useCallback(
    (error: unknown, source: "join" | "ensureMember"): boolean => {
      const code = getRoomServiceErrorCode(error);
      if (code === "ROOM_VERSION_MISMATCH") {
        const mismatch = error instanceof RoomServiceError ? error : null;
        const mismatchType =
          mismatch?.mismatchType === "client_outdated" || mismatch?.mismatchType === "room_outdated"
            ? mismatch.mismatchType
            : "unknown";
        traceAction("room.access.denied.versionMismatch", {
          roomId,
          source,
          mismatchType,
          roomVersion: mismatch?.roomVersion ?? null,
          clientVersion: mismatch?.clientVersion ?? APP_VERSION,
          serverVersion: mismatch?.serverVersion ?? null,
        });
        applyRoomAccessBlock(
          mismatchType === "client_outdated" ? "client-update-required" : "room-version-mismatch",
          {
            kind: "version-mismatch",
            mismatchType,
            roomVersion: mismatch?.roomVersion ?? null,
            clientVersion: mismatch?.clientVersion ?? APP_VERSION,
            serverVersion: mismatch?.serverVersion ?? null,
            source,
          }
        );
        return true;
      }
      if (code === "ROOM_VERSION_CHECK_FAILED") {
        const detail =
          error instanceof RoomServiceError ? error.checkFailedDetail ?? "unknown" : "unknown";
        traceError("room.access.denied.versionCheckFailed", error, {
          roomId,
          source,
          detail,
        });
        applyRoomAccessBlock("room-version-check-failed", {
          kind: "version-check-failed",
          detail,
          source,
        });
        return true;
      }
      return false;
    },
    [applyRoomAccessBlock, roomId]
  );

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

  const sync: RoomSyncState = useMemo(
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
      roomAccessBlocked,
      syncHealth,
      syncSnapshotAgeMs,
      syncRecoveryAttempts,
    ]
  );

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
    detachNow: detach,
    reattachPresence: reattachNow,
    leavingRef,
  };
}
