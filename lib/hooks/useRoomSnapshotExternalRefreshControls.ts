"use client";

import { ensureAuthSession } from "@/lib/firebase/authSession";
import { sanitizeRoom } from "@/lib/state/sanitize";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { storePrefetchedRoom } from "@/lib/prefetch/prefetchRoomExperience";
import { ROOM_SNAPSHOT_RESUME_WINDOW_MS } from "@/lib/hooks/roomSnapshotConfig";
import type { RoomSnapshotWatchdogEpisode, RoomSnapshotWatchdogTrigger } from "@/lib/hooks/roomSnapshotWatchdog";
import type { RoomDoc } from "@/lib/types";
import {
  doc,
  getDoc,
  getDocFromServer,
  type Firestore,
  type FirestoreError,
} from "firebase/firestore";
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

type ResumeProbe = {
  seq: number;
  at: number;
  trigger: RoomSnapshotWatchdogTrigger;
  baselineServerSnapshotAt: number | null;
  retryScheduled: boolean;
};

export function useRoomSnapshotExternalRestartListener(params: {
  roomId: string;
  leavingRef: MutableRefObject<boolean>;
  restartRoomListenerRef: MutableRefObject<((reason: string) => void) | null>;
}) {
  const { roomId, leavingRef, restartRoomListenerRef } = params;

  useEffect(() => {
    if (typeof window === "undefined") return () => undefined;
    if (!roomId) return () => undefined;

    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ roomId?: string; reason?: string }>
      ).detail;
      if (!detail || detail.roomId !== roomId) return;
      if (leavingRef.current) return;
      const reason =
        typeof detail.reason === "string" && detail.reason.trim().length > 0
          ? detail.reason.trim().slice(0, 160)
          : "unknown";
      restartRoomListenerRef.current?.(`external:${reason}`);
    };

    window.addEventListener("ito:room-restart-listener", handler as EventListener);
    return () => {
      window.removeEventListener(
        "ito:room-restart-listener",
        handler as EventListener
      );
    };
  }, [roomId, leavingRef, restartRoomListenerRef]);
}

export function useRoomSnapshotExternalForceRefresh(params: {
  roomId: string;
  firestore: Firestore | null;
  leavingRef: MutableRefObject<boolean>;
  forceRefreshInFlightRef: MutableRefObject<Promise<unknown> | null>;
  statusVersionRef: MutableRefObject<number>;
  lastServerStatusVersionRef: MutableRefObject<number>;
  lastRoomSnapshotAtRef: MutableRefObject<number | null>;
  lastRoomSnapshotAnyAtRef: MutableRefObject<number | null>;
  lastRoomSnapshotWasFromCacheRef: MutableRefObject<boolean>;
  roomSnapshotCacheSinceRef: MutableRefObject<number | null>;
  lastListenErrorAtRef: MutableRefObject<number | null>;
  lastListenErrorCodeRef: MutableRefObject<string | null>;
  syncEpisodeRef: MutableRefObject<RoomSnapshotWatchdogEpisode>;
  setSyncHealth: Dispatch<SetStateAction<"initial" | "ok" | "stale" | "recovering" | "blocked" | "paused">>;
  setSyncSnapshotAgeMs: Dispatch<SetStateAction<number | null>>;
  setSyncRecoveryAttempts: Dispatch<SetStateAction<number>>;
  setRoom: Dispatch<SetStateAction<(RoomDoc & { id: string }) | null>>;
  setRoomLoaded: Dispatch<SetStateAction<boolean>>;
  setRoomAccessError: Dispatch<SetStateAction<string | null>>;
  clearRoomAccessErrorDetail: () => void;
  prefetchedAppliedRef: MutableRefObject<boolean>;
  resumeProbeRef: MutableRefObject<ResumeProbe | null>;
  resumeForceRefreshRetryTimerRef: MutableRefObject<number | null>;
  enqueueCommit: (task: () => void, startedAt: number | null, metricKey?: string) => void;
}) {
  const {
    roomId,
    firestore,
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
  } = params;

  useEffect(() => {
    if (typeof window === "undefined") return () => undefined;
    if (!roomId || !firestore) return () => undefined;

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
        let forceRefreshFromCache = false;
        try {
          const roomRef = doc(firestore, "rooms", roomId);
          let snap: Awaited<ReturnType<typeof getDoc>> | null = null;
          let lastServerError: unknown | null = null;
          let lastServerErrorCode: string | null = null;
          const MAX_SERVER_FETCH_ATTEMPTS = 2;

          for (let attempt = 1; attempt <= MAX_SERVER_FETCH_ATTEMPTS; attempt += 1) {
            try {
              snap = await getDocFromServer(roomRef);
              lastServerError = null;
              lastServerErrorCode = null;
              break;
            } catch (error) {
              lastServerError = error;
              const code =
                (error as FirestoreError | undefined)?.code ??
                (error as { code?: string } | undefined)?.code ??
                null;
              lastServerErrorCode = code ?? null;
              setMetric("roomSnapshot", "forceRefresh.serverErrorTs", Date.now());
              setMetric("roomSnapshot", "forceRefresh.serverErrorCode", code ?? "unknown");
              setMetric("roomSnapshot", "forceRefresh.serverErrorAttempt", attempt);

              if (code === "permission-denied" || code === "unauthenticated") {
                setRoomAccessError("permission-denied");
                try {
                  await ensureAuthSession(`room-force-refresh:${reason}`);
                } catch {}
                continue;
              }
              if (code === "unavailable" || code === "deadline-exceeded") {
                await new Promise((resolve) =>
                  setTimeout(resolve, attempt === 1 ? 240 : 520)
                );
                continue;
              }
              break;
            }
          }

          if (!snap) {
            if (lastServerError) {
              traceError("room.snapshot.forceRefresh.server", lastServerError, {
                roomId,
                reason,
                code: lastServerErrorCode ?? undefined,
              });
            }
            snap = await getDoc(roomRef);
          }
          if (!snap.exists()) {
            traceAction("room.snapshot.forceRefresh.miss", { roomId, reason });
            return;
          }
          const fromCache = snap.metadata.fromCache === true;
          forceRefreshFromCache = fromCache;
          if (fromCache) {
            traceAction("room.snapshot.forceRefresh.fromCache", { roomId, reason });
            setMetric("roomSnapshot", "forceRefresh.fromCacheTs", Date.now());
            setMetric("roomSnapshot", "forceRefresh.fromCacheReason", reason);
          }
          const nowTs = Date.now();
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
          }
          if (!fromCache) {
            setRoomAccessError((prev) => {
              if (prev !== "permission-denied") return prev;
              clearRoomAccessErrorDetail();
              return null;
            });
            lastRoomSnapshotAtRef.current = nowTs;
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
          const rawData = snap.data();
          const sanitized = sanitizeRoom(rawData);
          const incomingVersion =
            typeof sanitized.statusVersion === "number" ? sanitized.statusVersion : 0;
          if (!fromCache) {
            lastServerStatusVersionRef.current = incomingVersion;
            setMetric("roomSnapshot", "lastServerStatusVersion", incomingVersion);
          }
          const currentVersion =
            typeof statusVersionRef.current === "number" ? statusVersionRef.current : 0;
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
            storePrefetchedRoom(roomId, sanitized as unknown as Record<string, unknown>);
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
          if (
            forceRefreshFromCache &&
            typeof window !== "undefined" &&
            typeof document !== "undefined" &&
            document.visibilityState === "visible"
          ) {
            const probe = resumeProbeRef.current;
            const now = Date.now();
            if (
              probe &&
              !probe.retryScheduled &&
              now - probe.at <= ROOM_SNAPSHOT_RESUME_WINDOW_MS &&
              (typeof navigator === "undefined" || navigator.onLine !== false)
            ) {
              probe.retryScheduled = true;
              setMetric("roomSnapshot", "resume.retryScheduledAt", now);
              setMetric("roomSnapshot", "resume.retryScheduledSeq", probe.seq);
              setMetric("roomSnapshot", "resume.retryScheduledReason", reason);
              if (resumeForceRefreshRetryTimerRef.current !== null) {
                clearTimeout(resumeForceRefreshRetryTimerRef.current);
                resumeForceRefreshRetryTimerRef.current = null;
              }
              const seq = probe.seq;
              resumeForceRefreshRetryTimerRef.current = window.setTimeout(() => {
                resumeForceRefreshRetryTimerRef.current = null;
                if (leavingRef.current) return;
                if (typeof document !== "undefined" && document.visibilityState !== "visible") {
                  return;
                }
                if (typeof navigator !== "undefined" && navigator.onLine === false) {
                  return;
                }
                const current = resumeProbeRef.current;
                if (!current || current.seq !== seq) return;
                try {
                  traceAction("room.snapshot.resume.retry", {
                    roomId,
                    seq: String(seq),
                    trigger: current.trigger,
                  });
                } catch {}
                try {
                  window.dispatchEvent(
                    new CustomEvent("ito:room-force-refresh", {
                      detail: {
                        roomId,
                        reason: `room.snapshot.resume.retry:${seq}`,
                      },
                    })
                  );
                } catch {}
                try {
                  window.dispatchEvent(
                    new CustomEvent("ito:room-restart-listener", {
                      detail: {
                        roomId,
                        reason: `room.snapshot.resume.retry:${seq}`,
                      },
                    })
                  );
                } catch {}
              }, 900);
            }
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
      if (resumeForceRefreshRetryTimerRef.current !== null) {
        clearTimeout(resumeForceRefreshRetryTimerRef.current);
        resumeForceRefreshRetryTimerRef.current = null;
      }
    };
  }, [
    enqueueCommit,
    firestore,
    forceRefreshInFlightRef,
    lastListenErrorAtRef,
    lastListenErrorCodeRef,
    lastRoomSnapshotAnyAtRef,
    lastRoomSnapshotAtRef,
    lastRoomSnapshotWasFromCacheRef,
    lastServerStatusVersionRef,
    leavingRef,
    prefetchedAppliedRef,
    resumeForceRefreshRetryTimerRef,
    resumeProbeRef,
    roomId,
    roomSnapshotCacheSinceRef,
    setRoom,
    setRoomAccessError,
    clearRoomAccessErrorDetail,
    setRoomLoaded,
    setSyncHealth,
    setSyncRecoveryAttempts,
    setSyncSnapshotAgeMs,
    statusVersionRef,
    syncEpisodeRef,
  ]);
}
