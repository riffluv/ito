"use client";

import { db, firebaseEnabled } from "@/lib/firebase/client";
import { ensureAuthSession } from "@/lib/firebase/authSession";
import { notify } from "@/components/ui/notify";
import { notifyPermissionRecovery } from "@/lib/firebase/permissionGuard";
import { useParticipants } from "@/lib/hooks/useParticipants";
import {
  ensureMember,
  joinRoomFully,
  getRoomServiceErrorCode,
  RoomServiceError,
} from "@/lib/services/roomService";
import { sanitizeRoom } from "@/lib/state/sanitize";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
import { logDebug, logError } from "@/lib/utils/log";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { scheduleIdleTask } from "@/lib/utils/idleScheduler";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { APP_VERSION } from "@/lib/constants/appVersion";
import deepEqual from "fast-deep-equal/es6";
import {
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  type FirestoreError,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { unstable_batchedUpdates } from "react-dom";
import {
  loadPrefetchedRoom,
  storePrefetchedRoom,
} from "@/lib/prefetch/prefetchRoomExperience";

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
  joinStatus: "idle" | "joining" | "retrying" | "joined";
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

const ROOM_SNAPSHOT_DEFER_ENABLED =
  process.env.NEXT_PUBLIC_PERF_ROOM_SNAPSHOT_DEFER === "1";

const MAX_JOIN_RETRIES = Number(process.env.NEXT_PUBLIC_ROOM_JOIN_RETRIES ?? 5);
// 連続 join での負荷を抑えるため既定値をやや長めに設定（env で上書き可能）
const BASE_JOIN_RETRY_DELAY_MS = 700;
const MAX_JOIN_RETRY_DELAY_MS = Number(
  process.env.NEXT_PUBLIC_ROOM_JOIN_RETRY_MAX_DELAY_MS ?? 7000
);
const JOIN_RETRY_BACKOFF_FACTOR = 2;
// presence が安定している前提で心拍間隔を緩める（必要なら env で短縮）
const DEFAULT_ENSURE_MEMBER_INTERVAL_MS = 90_000;
const parsedEnsureMemberInterval = Number(
  process.env.NEXT_PUBLIC_ENSURE_MEMBER_MIN_INTERVAL_MS ?? DEFAULT_ENSURE_MEMBER_INTERVAL_MS
);
const ENSURE_MEMBER_MIN_INTERVAL_MS =
  Number.isFinite(parsedEnsureMemberInterval) && parsedEnsureMemberInterval > 0
    ? parsedEnsureMemberInterval
    : DEFAULT_ENSURE_MEMBER_INTERVAL_MS;

const DEFAULT_ROOM_SNAPSHOT_INITIAL_STALE_MS = 20_000;
const DEFAULT_ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS = 2000;
const DEFAULT_ROOM_SNAPSHOT_RECOVERY_COOLDOWN_MS = 4000;
const DEFAULT_ROOM_SNAPSHOT_RECOVERY_SLOW_COOLDOWN_MS = 30_000;

const ROOM_SNAPSHOT_INITIAL_STALE_MS = (() => {
  const parsed = Number(
    process.env.NEXT_PUBLIC_ROOM_SNAPSHOT_INITIAL_STALE_MS ??
      DEFAULT_ROOM_SNAPSHOT_INITIAL_STALE_MS
  );
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_ROOM_SNAPSHOT_INITIAL_STALE_MS;
})();

const ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS = (() => {
  const parsed = Number(
    process.env.NEXT_PUBLIC_ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS ??
      DEFAULT_ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS
  );
  return Number.isFinite(parsed) && parsed > 200
    ? parsed
    : DEFAULT_ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS;
})();

type EnsureMemberHeartbeat = {
  roomId: string;
  uid: string;
  displayName: string | null | undefined;
  timestamp: number;
};

export function useRoomSnapshot(
  roomId: string,
  uid: string | null,
  displayName?: string | null
): RoomSnapshotState {
  const [room, setRoom] = useState<(RoomDoc & { id: string }) | null>(null);
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [players, setPlayers] = useState<(PlayerDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomAccessError, setRoomAccessError] = useState<string | null>(null);
  const [roomAccessErrorDetail, setRoomAccessErrorDetail] = useState<RoomAccessErrorDetail | null>(null);
  const [joinStatus, setJoinStatus] = useState<
    "idle" | "joining" | "retrying" | "joined"
  >("idle");

  const leavingRef = useRef(false);
  const joinCompletedRef = useRef(false);
  const joinInFlightRef = useRef<Promise<unknown> | null>(null);
  const joinRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinAttemptRef = useRef(0);
  const joinLimitNotifiedRef = useRef(false);
  const ensureMemberHeartbeatRef = useRef<EnsureMemberHeartbeat | null>(null);
  const statusVersionRef = useRef<number>(0);
  const forceRefreshInFlightRef = useRef<Promise<void> | null>(null);
  const restartRoomListenerRef = useRef<((reason: string) => void) | null>(null);

  const syncStartAtRef = useRef<number>(Date.now());
  const lastRoomSnapshotAtRef = useRef<number | null>(null);
  const lastListenErrorAtRef = useRef<number | null>(null);
  const lastListenErrorCodeRef = useRef<string | null>(null);
  const syncEpisodeRef = useRef<{
    active: boolean;
    startedAt: number;
    lastAttemptAt: number;
    attempts: number;
    lastTraceAt: number;
  }>({
    active: false,
    startedAt: 0,
    lastAttemptAt: 0,
    attempts: 0,
    lastTraceAt: 0,
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
    lastListenErrorAtRef.current = null;
    lastListenErrorCodeRef.current = null;
    syncEpisodeRef.current = {
      active: false,
      startedAt: 0,
      lastAttemptAt: 0,
      attempts: 0,
      lastTraceAt: 0,
    };
    setSyncHealth("initial");
    setSyncSnapshotAgeMs(null);
    setSyncRecoveryAttempts(0);
  }, [roomId]);

  useEffect(() => {
    const startedAt = typeof performance !== "undefined" ? performance.now() : null;
    enqueueCommit(() => {
      unstable_batchedUpdates(() => {
        setPlayers((prev) => (deepEqual(prev, fetchedPlayers) ? prev : fetchedPlayers));
      });
    }, startedAt, "participantsCommitMs");
  }, [fetchedPlayers, partLoading, enqueueCommit]);

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
          (snap) => {
            // Expose a lightweight heartbeat for debugging "snapshot stalled" reports.
            const nowTs = Date.now();
            lastRoomSnapshotAtRef.current = nowTs;
            lastListenErrorAtRef.current = null;
            lastListenErrorCodeRef.current = null;
            setMetric("roomSnapshot", "lastSnapshotTs", nowTs);
            setSyncHealth((prev) => (prev === "ok" ? prev : "ok"));
            setSyncSnapshotAgeMs((prev) => (prev === null ? prev : null));
            syncEpisodeRef.current.active = false;
            syncEpisodeRef.current.attempts = 0;
            syncEpisodeRef.current.lastAttemptAt = 0;
            setSyncRecoveryAttempts((prev) => (prev === 0 ? prev : 0));
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

  // Force-refresh room snapshot on demand (e.g. when host action succeeded but listener is stale)
  useEffect(() => {
    if (typeof window === "undefined") return () => undefined;
    if (!roomId || !db) return () => undefined;
    const firestore = db;

    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ roomId?: string; reason?: string }>
      ).detail;
      if (!detail || detail.roomId !== roomId) return;

      if (forceRefreshInFlightRef.current) {
        return;
      }

      const reason =
        typeof detail.reason === "string" && detail.reason.trim().length > 0
          ? detail.reason.trim().slice(0, 120)
          : "unknown";
      const startedAt =
        typeof performance !== "undefined" ? performance.now() : null;

      const task = (async () => {
        traceAction("room.snapshot.forceRefresh", { roomId, reason });
        try {
          const roomRef = doc(firestore, "rooms", roomId);
          const snap = await getDocFromServer(roomRef).catch(() => getDoc(roomRef));
          if (!snap.exists()) {
            traceAction("room.snapshot.forceRefresh.miss", { roomId, reason });
            return;
          }
          const nowTs = Date.now();
          lastRoomSnapshotAtRef.current = nowTs;
          lastListenErrorAtRef.current = null;
          lastListenErrorCodeRef.current = null;
          setMetric("roomSnapshot", "lastSnapshotTs", nowTs);
          setSyncHealth((prev) => (prev === "ok" ? prev : "ok"));
          setSyncSnapshotAgeMs((prev) => (prev === null ? prev : null));
          syncEpisodeRef.current.active = false;
          syncEpisodeRef.current.attempts = 0;
          syncEpisodeRef.current.lastAttemptAt = 0;
          setSyncRecoveryAttempts((prev) => (prev === 0 ? prev : 0));
          const rawData = snap.data();
          const sanitized = sanitizeRoom(rawData);
          const incomingVersion =
            typeof sanitized.statusVersion === "number"
              ? sanitized.statusVersion
              : 0;
          const currentVersion =
            typeof statusVersionRef.current === "number"
              ? statusVersionRef.current
              : 0;
          if (incomingVersion < currentVersion) {
            traceAction("room.snapshot.forceRefresh.ignored", {
              roomId,
              reason,
              incomingVersion: String(incomingVersion),
              currentVersion: String(currentVersion),
            });
            return;
          }

          enqueueCommit(() => {
            statusVersionRef.current = incomingVersion;
            setRoom({ id: snap.id, ...sanitized });
            setRoomLoaded(true);
            storePrefetchedRoom(
              roomId,
              sanitized as unknown as Record<string, unknown>
            );
            prefetchedAppliedRef.current = false;
          }, startedAt, "forceRefreshCommitMs");
        } catch (error) {
          traceError("room.snapshot.forceRefresh", error, { roomId, reason });
        } finally {
          if (
            startedAt !== null &&
            typeof performance !== "undefined" &&
            Number.isFinite(startedAt)
          ) {
            setMetric(
              "roomSnapshot",
              "forceRefreshMs",
              Math.round(performance.now() - startedAt)
            );
          }
        }
      })();

      forceRefreshInFlightRef.current = task;
      task.finally(() => {
        forceRefreshInFlightRef.current = null;
      });
    };

    window.addEventListener("ito:room-force-refresh", handler as EventListener);
    return () => {
      window.removeEventListener(
        "ito:room-force-refresh",
        handler as EventListener
      );
    };
  }, [roomId, enqueueCommit]);

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

    const check = (trigger: "init" | "interval" | "visibility" | "online") => {
      try {
        if (leavingRef.current) return;
        if (roomAccessBlocked) {
          setSyncHealth("blocked");
          setSyncSnapshotAgeMs(null);
          return;
        }
        if (document.visibilityState !== "visible") {
          setSyncHealth("paused");
          setSyncSnapshotAgeMs(null);
          return;
        }

        const now = Date.now();
        const lastSnapshotAt = lastRoomSnapshotAtRef.current;
        if (typeof lastSnapshotAt === "number") {
          setSyncHealth("ok");
          setSyncSnapshotAgeMs(null);
          return;
        }

        const baselineAt = syncStartAtRef.current;
        const ageMs = Math.max(0, now - baselineAt);
        const thresholdMs = ROOM_SNAPSHOT_INITIAL_STALE_MS;

        if (ageMs < thresholdMs) {
          setSyncHealth("initial");
          setSyncSnapshotAgeMs(null);
          return;
        }

        const episode = syncEpisodeRef.current;
        if (!episode.active) {
          episode.active = true;
          episode.startedAt = now;
          episode.lastAttemptAt = 0;
          episode.attempts = 0;
          episode.lastTraceAt = 0;
        }

        setSyncSnapshotAgeMs(Math.round(ageMs));

        const slowMode = episode.attempts >= 2;
        const cooldownMs = slowMode
          ? DEFAULT_ROOM_SNAPSHOT_RECOVERY_SLOW_COOLDOWN_MS
          : DEFAULT_ROOM_SNAPSHOT_RECOVERY_COOLDOWN_MS;
        if (now - episode.lastAttemptAt < cooldownMs) {
          setSyncHealth("stale");
          return;
        }

        episode.lastAttemptAt = now;
        episode.attempts += 1;
        setSyncRecoveryAttempts(episode.attempts);
        setSyncHealth("recovering");

        setMetric("roomSnapshot", "initialStuckDetectedAt", now);
        setMetric("roomSnapshot", "initialStuckAgeMs", Math.round(ageMs));
        setMetric("roomSnapshot", "initialStuckRecoveryAttempt", episode.attempts);

        const shouldTrace = now - episode.lastTraceAt > 20_000;
        if (shouldTrace) {
          episode.lastTraceAt = now;
          traceAction("room.snapshot.initialStuck", {
            roomId,
            trigger,
            ageMs: String(Math.round(ageMs)),
            thresholdMs: String(thresholdMs),
            attempt: String(episode.attempts),
            joinStatus,
            online:
              typeof navigator !== "undefined"
                ? navigator.onLine
                  ? "1"
                  : "0"
                : "unknown",
            lastListenErrorCode: lastListenErrorCodeRef.current ?? undefined,
          });
        }

        if (!forceRefreshInFlightRef.current) {
          try {
            window.dispatchEvent(
              new CustomEvent("ito:room-force-refresh", {
                detail: {
                  roomId,
                  reason: `room.snapshot.initialStuck:${episode.attempts}`,
                },
              })
            );
          } catch {}
        }

        if (episode.attempts >= 2) {
          restartRoomListenerRef.current?.(`initialStuck:${episode.attempts}`);
        }
      } catch (error) {
        traceError("room.snapshot.watchdog", error, { roomId });
      }
    };

    check("init");
    const handle = window.setInterval(() => check("interval"), ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS);
    const onVisibility = () => check("visibility");
    const onOnline = () => check("online");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      window.clearInterval(handle);
      document.removeEventListener("visibilitychange", onVisibility);
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

  // ensureMember heartbeat
  useEffect(() => {
    if (!room || !uid || !firebaseEnabled) return;
    if (roomAccessBlocked) return;
    const now = Date.now();
    const last = ensureMemberHeartbeatRef.current;
    if (last && now - last.timestamp < ENSURE_MEMBER_MIN_INTERVAL_MS) return;
    ensureMemberHeartbeatRef.current = {
      roomId,
      uid,
      displayName,
      timestamp: now,
    };
    ensureMember({ roomId, uid, displayName, clientVersion: APP_VERSION }).catch((error) => {
      handleRoomServiceAccessError(error, "ensureMember");
    });
  }, [room, uid, roomId, displayName, roomAccessBlocked, handleRoomServiceAccessError]);

  // auto join / join retry loop
  useEffect(() => {
    if (!firebaseEnabled) return;
    if (!uid || !room) return;
    if (leavingRef.current) return;
    if (roomAccessBlocked) return;
    if (!normalizedDisplayName) return;

    const clearRetryTimer = () => {
      if (joinRetryTimerRef.current) {
        clearTimeout(joinRetryTimerRef.current);
        joinRetryTimerRef.current = null;
      }
    };

    if (room.status === "waiting") {
      const alreadyJoined = joinCompletedRef.current;
      if (alreadyJoined) {
        clearRetryTimer();
        return;
      }
      if (joinInFlightRef.current) return;

      clearRetryTimer();
      const attemptBeforeCall = joinAttemptRef.current;
      const joinTask = joinRoomFully({
        roomId,
        uid,
        displayName: normalizedDisplayName,
        notifyChat: true,
      })
        .then(() => {
          joinCompletedRef.current = true;
          joinAttemptRef.current = 0;
          joinLimitNotifiedRef.current = false;
          clearRetryTimer();
          setJoinStatus("joined");
        })
        .catch((error) => {
          const code = getRoomServiceErrorCode(error);
          if (code === "ROOM_VERSION_MISMATCH" || code === "ROOM_VERSION_CHECK_FAILED") {
            handleRoomServiceAccessError(error, "join");
            joinCompletedRef.current = true;
            joinLimitNotifiedRef.current = true;
            clearRetryTimer();
            setJoinStatus("idle");
            return;
          }

          joinCompletedRef.current = false;
          const nextAttempt = attemptBeforeCall + 1;
          joinAttemptRef.current = nextAttempt;
          const cappedAttempt = Math.min(Math.max(nextAttempt, 1), MAX_JOIN_RETRIES);
          const delay = Math.min(
            BASE_JOIN_RETRY_DELAY_MS *
              Math.pow(JOIN_RETRY_BACKOFF_FACTOR, Math.max(cappedAttempt - 1, 0)),
            MAX_JOIN_RETRY_DELAY_MS
          );
          const reachedLimit = nextAttempt > MAX_JOIN_RETRIES;

          if (reachedLimit && !joinLimitNotifiedRef.current) {
            joinLimitNotifiedRef.current = true;
            notify({
              title: "接続を再試行しています",
              description: "参加処理が続けて失敗しています。ネットワークを確認しつつ、このまま再試行します。",
              type: "warning",
            });
          }

          logDebug("room-snapshot", "joinRoomFully-retry", {
            roomId,
            uid,
            delay,
            reachedLimit,
          });

          clearRetryTimer();
          joinRetryTimerRef.current = setTimeout(() => {
            joinRetryTimerRef.current = null;
            setJoinStatus("retrying");
          }, delay);

          if (reachedLimit) {
            logError("room-snapshot", "joinRoomFully-max-retries-keep-retrying", {
              error,
              roomId,
              uid,
              attempt: nextAttempt,
            });
          }
        })
        .finally(() => {
          joinInFlightRef.current = null;
        });

      joinInFlightRef.current = joinTask;
      setJoinStatus("joining");
      joinTask.catch(() => void 0);
    } else {
      joinAttemptRef.current = 0;
      if (joinRetryTimerRef.current) {
        clearTimeout(joinRetryTimerRef.current);
        joinRetryTimerRef.current = null;
      }
      const joined = room && isMember;
      setJoinStatus(joined ? "joined" : "idle");
    }
  }, [roomId, uid, room, normalizedDisplayName, isMember, roomAccessBlocked, joinStatus, handleRoomServiceAccessError]);

  // ensureMember heartbeat via background interval
  useEffect(() => {
    if (!firebaseEnabled || !uid || !room || leavingRef.current) {
      return undefined;
    }
    if (roomAccessBlocked) {
      return undefined;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const last = ensureMemberHeartbeatRef.current;
      if (last && now - last.timestamp < ENSURE_MEMBER_MIN_INTERVAL_MS) return;
      ensureMemberHeartbeatRef.current = {
        roomId,
        uid,
        displayName,
        timestamp: now,
      };
      ensureMember({ roomId, uid, displayName, clientVersion: APP_VERSION }).catch((error) => {
        handleRoomServiceAccessError(error, "ensureMember");
      });
    }, ENSURE_MEMBER_MIN_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [roomId, uid, room, displayName, roomAccessBlocked, handleRoomServiceAccessError]);

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
