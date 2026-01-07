"use client";

import { db } from "@/lib/firebase/client";
import { ensureAuthSession } from "@/lib/firebase/authSession";
import { storePrefetchedRoom } from "@/lib/prefetch/prefetchRoomExperience";
import { sanitizeRoom } from "@/lib/state/sanitize";
import type { RoomSnapshotWatchdogEpisode, RoomSnapshotWatchdogTrigger } from "@/lib/hooks/roomSnapshotWatchdog";
import type { RoomDoc } from "@/lib/types";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
import { scheduleIdleTask } from "@/lib/utils/idleScheduler";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import deepEqual from "fast-deep-equal/es6";
import { doc, getDoc, onSnapshot, type FirestoreError } from "firebase/firestore";
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

type RoomSyncHealth =
  | "initial"
  | "ok"
  | "stale"
  | "recovering"
  | "blocked"
  | "paused";

type RoomAccessState = {
  state: "unknown" | "checking" | "granted" | "denied";
  retryAt: number;
};

type RoomSnapshotResumeProbe = {
  seq: number;
  at: number;
  trigger: RoomSnapshotWatchdogTrigger;
  baselineServerSnapshotAt: number | null;
  retryScheduled: boolean;
};

export function useRoomSnapshotRoomListener(params: {
  roomId: string;
  enqueueCommit: (task: () => void, startedAt: number | null, metricKey?: string) => void;
  setRoom: Dispatch<SetStateAction<(RoomDoc & { id: string }) | null>>;
  setRoomLoaded: Dispatch<SetStateAction<boolean>>;
  setRoomAccessError: Dispatch<SetStateAction<string | null>>;
  clearRoomAccessErrorDetail: () => void;
  roomAccessStateRef: MutableRefObject<RoomAccessState>;
  roomAccessCheckRef: MutableRefObject<Promise<boolean> | null>;
  statusVersionRef: MutableRefObject<number>;
  prefetchedAppliedRef: MutableRefObject<boolean>;
  lastServerStatusVersionRef: MutableRefObject<number>;
  lastRoomSnapshotAtRef: MutableRefObject<number | null>;
  lastRoomSnapshotAnyAtRef: MutableRefObject<number | null>;
  lastRoomSnapshotWasFromCacheRef: MutableRefObject<boolean>;
  roomSnapshotCacheSinceRef: MutableRefObject<number | null>;
  lastListenErrorAtRef: MutableRefObject<number | null>;
  lastListenErrorCodeRef: MutableRefObject<string | null>;
  syncEpisodeRef: MutableRefObject<RoomSnapshotWatchdogEpisode>;
  setSyncHealth: Dispatch<SetStateAction<RoomSyncHealth>>;
  setSyncSnapshotAgeMs: Dispatch<SetStateAction<number | null>>;
  setSyncRecoveryAttempts: Dispatch<SetStateAction<number>>;
  restartRoomListenerRef: MutableRefObject<((reason: string) => void) | null>;
  resumeProbeRef: MutableRefObject<RoomSnapshotResumeProbe | null>;
  resumeForceRefreshRetryTimerRef: MutableRefObject<number | null>;
}) {
  const {
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
  } = params;

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
            clearRoomAccessErrorDetail();
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
                clearRoomAccessErrorDetail();
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
  }, [
    clearRoomAccessErrorDetail,
    enqueueCommit,
    lastListenErrorAtRef,
    lastListenErrorCodeRef,
    lastRoomSnapshotAnyAtRef,
    lastRoomSnapshotAtRef,
    lastRoomSnapshotWasFromCacheRef,
    lastServerStatusVersionRef,
    prefetchedAppliedRef,
    restartRoomListenerRef,
    resumeForceRefreshRetryTimerRef,
    resumeProbeRef,
    roomAccessCheckRef,
    roomAccessStateRef,
    roomId,
    roomSnapshotCacheSinceRef,
    setRoom,
    setRoomAccessError,
    setRoomLoaded,
    setSyncHealth,
    setSyncRecoveryAttempts,
    setSyncSnapshotAgeMs,
    statusVersionRef,
    syncEpisodeRef,
  ]);
}
