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
import { sanitizeRoom } from "@/lib/state/sanitize";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { scheduleIdleTask } from "@/lib/utils/idleScheduler";
import { applyRoomSyncPatch } from "@/lib/sync/applyRoomSyncPatch";
import { parseRoomSyncPatch } from "@/lib/sync/roomSyncPatch";
import {
  evaluateRoomSnapshotWatchdog,
  type RoomSnapshotWatchdogEpisode,
  type RoomSnapshotWatchdogTrigger,
} from "@/lib/hooks/roomSnapshotWatchdog";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { APP_VERSION } from "@/lib/constants/appVersion";
import deepEqual from "fast-deep-equal/es6";
import {
  doc,
  getDoc,
  onSnapshot,
  type FirestoreError,
} from "firebase/firestore";
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
  DEFAULT_ROOM_SNAPSHOT_RECOVERY_COOLDOWN_MS,
  DEFAULT_ROOM_SNAPSHOT_RECOVERY_SLOW_COOLDOWN_MS,
  DEFAULT_ROOM_SNAPSHOT_TRACE_INTERVAL_MS,
  ROOM_SNAPSHOT_CACHE_ONLY_RESUME_STALE_MS,
  ROOM_SNAPSHOT_CACHE_ONLY_STALE_MS,
  ROOM_SNAPSHOT_DEFER_ENABLED,
  ROOM_SNAPSHOT_INITIAL_STALE_MS,
  ROOM_SNAPSHOT_POST_STALE_MS,
  ROOM_SNAPSHOT_RECOVERY_HARD_COOLDOWN_MS,
  ROOM_SNAPSHOT_RECOVERY_MAX_ATTEMPTS,
  ROOM_SNAPSHOT_RESUME_WINDOW_MS,
  ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS,
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

  // Firestore room snapshot subscribe with backoff
  useEffect(() => {
    if (!roomId) {
      const startedAt = typeof performance !== "undefined" ? performance.now() : null;
      enqueueCommit(() => {
        setRoom(null);
        setRoomLoaded(true);
        statusVersionRef.current = 0;
        prefetchedAppliedRef.current = false;
        lastRoomSnapshotAtRef.current = null;
      }, startedAt);
      return () => {};
    }

    const unsubRef = { current: null as null | (() => void) };
    const backoffUntilRef = { current: 0 };
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;
    let retryAttempt = 0;
    let permissionRetryAttempt = 0;
    let prevRoomSnapshot: { id: string | null; data: ReturnType<typeof sanitizeRoom> | null } = {
      id: null,
      data: null,
    };

    const stop = () => {
      try {
        unsubRef.current?.();
      } catch {}
      unsubRef.current = null;
    };

    const resetAttempts = () => {
      retryAttempt = 0;
      permissionRetryAttempt = 0;
      backoffUntilRef.current = 0;
    };

    const scheduleRetry = (reason: "permission" | "other") => {
      const attempt = reason === "permission" ? ++permissionRetryAttempt : ++retryAttempt;
      const baseDelay = reason === "permission" ? 5000 : 2000;
      const delayMs = Math.min(30_000, Math.round(baseDelay * Math.pow(2, Math.max(attempt - 1, 0))));
      backoffUntilRef.current = Date.now() + delayMs;
      if (backoffTimer) {
        try {
          clearTimeout(backoffTimer);
        } catch {}
      }
      backoffTimer = setTimeout(() => {
        backoffTimer = null;
        maybeStart();
      }, delayMs);
    };

    const ensureRoomAccess = () => {
      if (!roomId || !db) return Promise.resolve(false);
      const now = Date.now();
      const accessState = roomAccessStateRef.current;
      if (accessState.state === "denied" && now < accessState.retryAt) {
        return Promise.resolve(false);
      }
      if (roomAccessCheckRef.current) {
        return roomAccessCheckRef.current;
      }
      const roomRef = doc(db!, "rooms", roomId);
      const promise = getDoc(roomRef)
        .then(() => {
          roomAccessStateRef.current = { state: "granted", retryAt: 0 };
          setRoomAccessError((prev) => {
            if (prev !== "permission-denied") return prev;
            setRoomAccessErrorDetail(null);
            return null;
          });
          return true;
        })
        .catch((error) => {
          const code =
            (error as FirestoreError)?.code ??
            (error as { code?: string }).code ??
            null;
          if (code === "permission-denied") {
            roomAccessStateRef.current = {
              state: "denied",
              retryAt: Date.now() + 5000,
            };
            setRoomAccessError("permission-denied");
            ensureAuthSession("room-access-check").catch(() => void 0);
            return false;
          }
          roomAccessStateRef.current = {
            state: "unknown",
            retryAt: Date.now() + 2000,
          };
          traceError("room.snapshot.prefetch", error, { roomId });
          return false;
        })
        .finally(() => {
          roomAccessCheckRef.current = null;
        });
      roomAccessCheckRef.current = promise;
      return promise;
    };

    const maybeStart = () => {
      if (unsubRef.current) return;
      const now = Date.now();
      if (now < backoffUntilRef.current) return;
      const start = async () => {
        const hasAccess = await ensureRoomAccess();
        if (!hasAccess) {
          const reason = roomAccessStateRef.current.state === "denied" ? "permission" : "other";
          scheduleRetry(reason);
          return;
        }
        unsubRef.current = onSnapshot(
          doc(db!, "rooms", roomId),
          { includeMetadataChanges: true },
          (snap) => {
            // Expose a lightweight heartbeat for debugging "snapshot stalled" reports.
            const nowTs = Date.now();
            const fromCache = snap.metadata.fromCache === true;
            lastRoomSnapshotAnyAtRef.current = nowTs;
            lastRoomSnapshotWasFromCacheRef.current = fromCache;
            setMetric("roomSnapshot", "lastAnySnapshotTs", nowTs);
            setMetric("roomSnapshot", "lastSnapshotSource", fromCache ? "cache" : "server");
            if (fromCache) {
              setMetric("roomSnapshot", "lastCacheSnapshotTs", nowTs);
              if (roomSnapshotCacheSinceRef.current === null) {
                roomSnapshotCacheSinceRef.current = nowTs;
              }
            } else {
              roomSnapshotCacheSinceRef.current = null;
              lastRoomSnapshotAtRef.current = nowTs;
              const probe = resumeProbeRef.current;
              if (probe && probe.at > 0 && probe.at <= nowTs) {
                const syncMs = Math.max(0, nowTs - probe.at);
                setMetric("roomSnapshot", "resume.serverSyncMs", Math.round(syncMs));
                setMetric("roomSnapshot", "resume.serverSyncSeq", probe.seq);
                setMetric("roomSnapshot", "resume.serverSyncTrigger", probe.trigger);
                if (syncMs >= 2500) {
                  traceAction("room.snapshot.resume.slowServerSync", {
                    roomId,
                    trigger: probe.trigger,
                    seq: String(probe.seq),
                    syncMs: String(Math.round(syncMs)),
                  });
                }
                resumeProbeRef.current = null;
                if (resumeForceRefreshRetryTimerRef.current !== null) {
                  clearTimeout(resumeForceRefreshRetryTimerRef.current);
                  resumeForceRefreshRetryTimerRef.current = null;
                }
              }
              lastListenErrorAtRef.current = null;
              lastListenErrorCodeRef.current = null;
              setMetric("roomSnapshot", "lastSnapshotTs", nowTs);
              setSyncHealth((prev) => (prev === "ok" ? prev : "ok"));
              setSyncSnapshotAgeMs((prev) => (prev === null ? prev : null));
              syncEpisodeRef.current.active = false;
              syncEpisodeRef.current.kind = null;
              syncEpisodeRef.current.attempts = 0;
              syncEpisodeRef.current.lastAttemptAt = 0;
              syncEpisodeRef.current.lastTraceAt = 0;
              syncEpisodeRef.current.hardCooldownUntil = 0;
              setSyncRecoveryAttempts((prev) => (prev === 0 ? prev : 0));
            }
            const receivedAt =
              typeof performance !== "undefined" ? performance.now() : null;
            if (!snap.exists()) {
              resetAttempts();
              enqueueCommit(() => {
                prevRoomSnapshot = { id: null, data: null };
                setRoom(null);
                statusVersionRef.current = 0;
                setRoomLoaded(true);
                storePrefetchedRoom(roomId, null);
                prefetchedAppliedRef.current = false;
              }, receivedAt, "roomSnapshotCommitMs");
              return;
            }

            const rawData = snap.data();
            const sanitized = sanitizeRoom(rawData);
            resetAttempts();
            if (
              prevRoomSnapshot.data &&
              prevRoomSnapshot.id === snap.id &&
              deepEqual(prevRoomSnapshot.data, sanitized)
            ) {
              return;
            }

            const incomingVersion =
              typeof sanitized.statusVersion === "number"
                ? sanitized.statusVersion
                : 0;
            if (!fromCache) {
              lastServerStatusVersionRef.current = incomingVersion;
              setMetric("roomSnapshot", "lastServerStatusVersion", incomingVersion);
            }
            const currentVersion =
              typeof statusVersionRef.current === "number"
                ? statusVersionRef.current
                : 0;
            if (incomingVersion < currentVersion) {
              // 古いスナップショットは破棄
              return;
            }

            enqueueCommit(() => {
              prevRoomSnapshot = { id: snap.id, data: sanitized };
              statusVersionRef.current = incomingVersion;
              setRoom({ id: snap.id, ...sanitized });
              setRoomLoaded(true);
              storePrefetchedRoom(
                roomId,
                sanitized as unknown as Record<string, unknown>
              );
              prefetchedAppliedRef.current = false;
              setRoomAccessError((prev) => {
                if (prev !== "permission-denied") return prev;
                setRoomAccessErrorDetail(null);
                return null;
              });
              roomAccessStateRef.current = { state: "granted", retryAt: 0 };
            }, receivedAt, "roomSnapshotCommitMs");
          },
          (error) => {
            const nowTs = Date.now();
            const code = (error as FirestoreError)?.code ?? null;
            setMetric("roomSnapshot", "lastListenErrorTs", nowTs);
            setMetric("roomSnapshot", "lastListenErrorCode", code ?? "unknown");
            lastListenErrorAtRef.current = nowTs;
            lastListenErrorCodeRef.current = code ?? "unknown";
            setSyncHealth((prev) => (prev === "recovering" ? prev : "recovering"));
            const lastSnapshotAt = lastRoomSnapshotAtRef.current;
            if (typeof lastSnapshotAt === "number") {
              setSyncSnapshotAgeMs(Math.max(0, nowTs - lastSnapshotAt));
            }
            // Listener errors terminate the stream; clear local unsubscribe ref so backoff restart can reattach.
            stop();
            if (code === "permission-denied") {
              setRoomAccessError("permission-denied");
              ensureAuthSession("room-snapshot").catch(() => void 0);
              scheduleRetry("permission");
              return;
            }
            if (isFirebaseQuotaExceeded(error)) {
              handleFirebaseQuotaError("ルーム情報の取得");
            }
            traceError("room.snapshot.listen", error, { roomId });
            scheduleRetry("other");
          }
        );
      };
      start().catch(() => scheduleRetry("other"));
    };

    restartRoomListenerRef.current = (reason: string) => {
      try {
        stop();
        resetAttempts();
        traceAction("room.snapshot.restart", { roomId, reason });
      } catch (error) {
        traceError("room.snapshot.restart", error, { roomId, reason });
      } finally {
        try {
          maybeStart();
        } catch {
          scheduleRetry("other");
        }
      }
    };

    const cancelIdleStart = scheduleIdleTask(
      () => {
        try {
          maybeStart();
        } catch {
          scheduleRetry("other");
        }
      },
      { delayMs: 40, timeoutMs: 200 }
    );

    return () => {
      restartRoomListenerRef.current = null;
      cancelIdleStart?.();
      stop();
      if (backoffTimer) {
        clearTimeout(backoffTimer);
      }
    };
  }, [roomId, enqueueCommit]);

  useRoomSnapshotExternalRestartListener({
    roomId,
    leavingRef,
    restartRoomListenerRef,
  });

  const clearRoomAccessErrorDetail = useCallback(() => {
    setRoomAccessErrorDetail(null);
  }, [setRoomAccessErrorDetail]);

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

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return () => {};
    }
    if (!roomId || !firebaseEnabled) {
      return () => {};
    }

    const check = (trigger: RoomSnapshotWatchdogTrigger) => {
      try {
        if (leavingRef.current) return;

        if (
          (trigger === "visibility" || trigger === "focus") &&
          joinStatus !== "idle" &&
          !roomAccessBlocked
        ) {
          const now = Date.now();
          if (now - resumeKickAtRef.current >= 1200) {
            resumeKickAtRef.current = now;
            const seq = (resumeProbeSeqRef.current += 1);
            resumeProbeRef.current = {
              seq,
              at: now,
              trigger,
              baselineServerSnapshotAt: lastRoomSnapshotAtRef.current,
              retryScheduled: false,
            };
            setMetric("roomSnapshot", "resume.kickAt", now);
            setMetric("roomSnapshot", "resume.kickSeq", seq);
            setMetric("roomSnapshot", "resume.kickTrigger", trigger);
            setMetric(
              "roomSnapshot",
              "resume.kickBaselineServerSnapshotTs",
              lastRoomSnapshotAtRef.current
            );
            if (resumeForceRefreshRetryTimerRef.current !== null) {
              clearTimeout(resumeForceRefreshRetryTimerRef.current);
              resumeForceRefreshRetryTimerRef.current = null;
            }
            try {
              window.dispatchEvent(
                new CustomEvent("ito:room-force-refresh", {
                  detail: {
                    roomId,
                    reason: `room.snapshot.resume:${trigger}`,
                  },
                })
              );
            } catch {}
            try {
              window.dispatchEvent(
                new CustomEvent("ito:room-restart-listener", {
                  detail: {
                    roomId,
                    reason: `room.snapshot.resume:${trigger}`,
                  },
                })
              );
            } catch {}
          }
        }

        const now = Date.now();
        const probe = resumeProbeRef.current;
        const inResumeWindow =
          !!probe &&
          probe.at > 0 &&
          now - probe.at <= ROOM_SNAPSHOT_RESUME_WINDOW_MS &&
          document.visibilityState === "visible";
        const decision = evaluateRoomSnapshotWatchdog(
          {
            now,
            trigger,
            joinStatus,
            roomAccessBlocked,
            visible: document.visibilityState === "visible",
            online:
              typeof navigator !== "undefined" ? (navigator.onLine as boolean) : undefined,
            lastServerSnapshotAt: lastRoomSnapshotAtRef.current,
            lastSnapshotWasFromCache: lastRoomSnapshotWasFromCacheRef.current,
            cacheOnlySince: roomSnapshotCacheSinceRef.current,
            syncStartAt: syncStartAtRef.current,
            episode: syncEpisodeRef.current,
          },
          {
            initialStaleMs: ROOM_SNAPSHOT_INITIAL_STALE_MS,
            postStaleMs: ROOM_SNAPSHOT_POST_STALE_MS,
            cacheOnlyStaleMs: inResumeWindow
              ? ROOM_SNAPSHOT_CACHE_ONLY_RESUME_STALE_MS
              : ROOM_SNAPSHOT_CACHE_ONLY_STALE_MS,
            recoveryCooldownMs: DEFAULT_ROOM_SNAPSHOT_RECOVERY_COOLDOWN_MS,
            recoverySlowCooldownMs: DEFAULT_ROOM_SNAPSHOT_RECOVERY_SLOW_COOLDOWN_MS,
            recoveryMaxAttempts: ROOM_SNAPSHOT_RECOVERY_MAX_ATTEMPTS,
            recoveryHardCooldownMs: ROOM_SNAPSHOT_RECOVERY_HARD_COOLDOWN_MS,
            traceIntervalMs: DEFAULT_ROOM_SNAPSHOT_TRACE_INTERVAL_MS,
          }
        );

        syncEpisodeRef.current = decision.nextEpisode;
        setSyncHealth(decision.nextHealth);
        setSyncRecoveryAttempts(decision.nextRecoveryAttempts);
        if (decision.nextHealth === "stale" || decision.nextHealth === "recovering") {
          setSyncSnapshotAgeMs(decision.nextSnapshotAgeMs);
        } else {
          setSyncSnapshotAgeMs((prev) => (prev === null ? prev : null));
        }

        const kind = decision.staleKind;
        if (!kind) return;

        const attempt = decision.nextRecoveryAttempts;
        const ageMs =
          typeof decision.staleAgeMs === "number" ? Math.round(decision.staleAgeMs) : null;
        const thresholdMs =
          typeof decision.staleThresholdMs === "number"
            ? Math.round(decision.staleThresholdMs)
            : null;

        if (decision.exhausted) {
          setMetric("roomSnapshot", "staleRecoveryExhaustedAt", now);
          setMetric("roomSnapshot", "staleRecoveryExhaustedKind", kind);
        }

        if (decision.shouldTrace) {
          if (kind === "initial") {
            traceAction("room.snapshot.initialStuck", {
              roomId,
              trigger,
              ageMs: ageMs !== null ? String(ageMs) : undefined,
              thresholdMs: thresholdMs !== null ? String(thresholdMs) : undefined,
              attempt: String(attempt),
              joinStatus,
              online:
                typeof navigator !== "undefined"
                  ? navigator.onLine
                    ? "1"
                    : "0"
                  : "unknown",
              lastListenErrorCode: lastListenErrorCodeRef.current ?? undefined,
            });
          } else {
            traceAction("room.snapshot.staleDetected", {
              roomId,
              kind,
              trigger,
              ageMs: ageMs !== null ? String(ageMs) : undefined,
              thresholdMs: thresholdMs !== null ? String(thresholdMs) : undefined,
              attempt: String(attempt),
              joinStatus,
              online:
                typeof navigator !== "undefined"
                  ? navigator.onLine
                    ? "1"
                    : "0"
                  : "unknown",
              fromCache: lastRoomSnapshotWasFromCacheRef.current ? "1" : "0",
              lastListenErrorCode: lastListenErrorCodeRef.current ?? undefined,
            });
          }
        }

        if (!decision.shouldForceRefresh) {
          return;
        }

        const reason =
          kind === "initial"
            ? `room.snapshot.initialStuck:${attempt}`
            : kind === "cache-only"
              ? `room.snapshot.cacheOnly:${attempt}`
              : `room.snapshot.postStale:${attempt}`;

        setMetric("roomSnapshot", "staleDetectedAt", now);
        setMetric("roomSnapshot", "staleDetectedKind", kind);
        setMetric("roomSnapshot", "staleDetectedTrigger", trigger);
        setMetric("roomSnapshot", "staleDetectedAgeMs", ageMs !== null ? ageMs : null);
        setMetric("roomSnapshot", "staleDetectedThresholdMs", thresholdMs !== null ? thresholdMs : null);
        setMetric("roomSnapshot", "staleDetectedAttempt", attempt);

        if (!forceRefreshInFlightRef.current) {
          try {
            window.dispatchEvent(
              new CustomEvent("ito:room-force-refresh", {
                detail: { roomId, reason },
              })
            );
          } catch {}
        }

        if (decision.shouldRestartListener) {
          restartRoomListenerRef.current?.(reason);
        }
      } catch (error) {
        traceError("room.snapshot.watchdog", error, { roomId });
      }
    };

    check("init");
    const handle = window.setInterval(() => check("interval"), ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS);
    const onVisibility = () => check("visibility");
    const onFocus = () => check("focus");
    const onOnline = () => check("online");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      window.clearInterval(handle);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [roomId, roomAccessBlocked, joinStatus]);

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
