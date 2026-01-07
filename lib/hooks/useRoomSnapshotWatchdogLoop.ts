"use client";

import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  evaluateRoomSnapshotWatchdog,
  type RoomSnapshotWatchdogEpisode,
  type RoomSnapshotWatchdogTrigger,
} from "@/lib/hooks/roomSnapshotWatchdog";
import {
  DEFAULT_ROOM_SNAPSHOT_RECOVERY_COOLDOWN_MS,
  DEFAULT_ROOM_SNAPSHOT_RECOVERY_SLOW_COOLDOWN_MS,
  DEFAULT_ROOM_SNAPSHOT_TRACE_INTERVAL_MS,
  ROOM_SNAPSHOT_CACHE_ONLY_RESUME_STALE_MS,
  ROOM_SNAPSHOT_CACHE_ONLY_STALE_MS,
  ROOM_SNAPSHOT_INITIAL_STALE_MS,
  ROOM_SNAPSHOT_POST_STALE_MS,
  ROOM_SNAPSHOT_RECOVERY_HARD_COOLDOWN_MS,
  ROOM_SNAPSHOT_RECOVERY_MAX_ATTEMPTS,
  ROOM_SNAPSHOT_RESUME_WINDOW_MS,
  ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS,
} from "@/lib/hooks/roomSnapshotConfig";
import type { RoomJoinStatus } from "@/lib/hooks/useRoomSnapshotAutoJoin";
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

export function useRoomSnapshotWatchdogLoop(params: {
  firebaseEnabled: boolean;
  roomId: string;
  roomAccessBlocked: boolean;
  joinStatus: RoomJoinStatus;
  leavingRef: MutableRefObject<boolean>;
  forceRefreshInFlightRef: MutableRefObject<Promise<unknown> | null>;
  restartRoomListenerRef: MutableRefObject<((reason: string) => void) | null>;
  resumeKickAtRef: MutableRefObject<number>;
  resumeProbeSeqRef: MutableRefObject<number>;
  resumeProbeRef: MutableRefObject<RoomSnapshotResumeProbe | null>;
  resumeForceRefreshRetryTimerRef: MutableRefObject<number | null>;
  lastRoomSnapshotAtRef: MutableRefObject<number | null>;
  lastRoomSnapshotWasFromCacheRef: MutableRefObject<boolean>;
  roomSnapshotCacheSinceRef: MutableRefObject<number | null>;
  lastListenErrorCodeRef: MutableRefObject<string | null>;
  syncStartAtRef: MutableRefObject<number>;
  syncEpisodeRef: MutableRefObject<RoomSnapshotWatchdogEpisode>;
  setSyncHealth: Dispatch<SetStateAction<RoomSyncHealth>>;
  setSyncSnapshotAgeMs: Dispatch<SetStateAction<number | null>>;
  setSyncRecoveryAttempts: Dispatch<SetStateAction<number>>;
}) {
  const {
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
  } = params;

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
  }, [
    firebaseEnabled,
    forceRefreshInFlightRef,
    joinStatus,
    lastListenErrorCodeRef,
    lastRoomSnapshotAtRef,
    lastRoomSnapshotWasFromCacheRef,
    leavingRef,
    restartRoomListenerRef,
    resumeForceRefreshRetryTimerRef,
    resumeKickAtRef,
    resumeProbeRef,
    resumeProbeSeqRef,
    roomAccessBlocked,
    roomId,
    roomSnapshotCacheSinceRef,
    setSyncHealth,
    setSyncRecoveryAttempts,
    setSyncSnapshotAgeMs,
    syncEpisodeRef,
    syncStartAtRef,
  ]);
}

