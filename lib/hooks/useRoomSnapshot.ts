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
import { traceError } from "@/lib/utils/trace";
import { scheduleIdleTask } from "@/lib/utils/idleScheduler";
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
  detachNow: () => void;
  reattachPresence: () => void;
  leavingRef: React.MutableRefObject<boolean>;
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

  const prefetchedAppliedRef = useRef(false);
  const deferEnabled = ROOM_SNAPSHOT_DEFER_ENABLED;

  const roomAccessStateRef = useRef<{
    state: "unknown" | "checking" | "granted" | "denied";
    retryAt: number;
  }>({ state: "unknown", retryAt: 0 });
  const roomAccessCheckRef = useRef<Promise<boolean> | null>(null);
  const prevRoomAccessErrorRef = useRef<string | null>(null);

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
        prefetchedAppliedRef.current = false;
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
          setRoomAccessError(null);
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
            const receivedAt =
              typeof performance !== "undefined" ? performance.now() : null;
            if (!snap.exists()) {
              resetAttempts();
              enqueueCommit(() => {
                prevRoomSnapshot = { id: null, data: null };
                setRoom(null);
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

            enqueueCommit(() => {
              prevRoomSnapshot = { id: snap.id, data: sanitized };
              setRoom({ id: snap.id, ...sanitized });
              setRoomLoaded(true);
              storePrefetchedRoom(
                roomId,
                sanitized as unknown as Record<string, unknown>
              );
              prefetchedAppliedRef.current = false;
              setRoomAccessError(null);
              roomAccessStateRef.current = { state: "granted", retryAt: 0 };
            }, receivedAt, "roomSnapshotCommitMs");
          },
          (error) => {
            const code = (error as FirestoreError)?.code ?? null;
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
      cancelIdleStart?.();
      stop();
      if (backoffTimer) {
        clearTimeout(backoffTimer);
      }
    };
  }, [roomId, enqueueCommit]);

  // ensureMember heartbeat
  useEffect(() => {
    if (!room || !uid || !firebaseEnabled) return;
    const now = Date.now();
    const last = ensureMemberHeartbeatRef.current;
    if (last && now - last.timestamp < ENSURE_MEMBER_MIN_INTERVAL_MS) return;
    ensureMemberHeartbeatRef.current = {
      roomId,
      uid,
      displayName,
      timestamp: now,
    };
    ensureMember({ roomId, uid, displayName, clientVersion: APP_VERSION }).catch(() => void 0);
  }, [room, uid, roomId, displayName]);

  // auto join / join retry loop
  useEffect(() => {
    if (!firebaseEnabled) return;
    if (!uid || !room) return;
    if (leavingRef.current) return;
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
          if (code === "ROOM_VERSION_MISMATCH") {
            const mismatch = error instanceof RoomServiceError ? error : null;
            const roomVersion = mismatch?.roomVersion ?? "不明";
            const clientVersion = mismatch?.clientVersion ?? APP_VERSION;
            notify({
              title: "この部屋には参加できません",
              description: `部屋はバージョン ${roomVersion} で進行中です。お使いのバージョン (${clientVersion}) からは参加できません。新しい部屋を作成するか、招待を確認してください。`,
              type: "error",
            });
            joinCompletedRef.current = true;
            joinLimitNotifiedRef.current = true;
            clearRetryTimer();
            setJoinStatus("idle");
            return;
          }

          if (code === "ROOM_VERSION_CHECK_FAILED") {
            // バージョン確認 API 自体が失敗したケース（ネットワークエラー等）
            // フェイルクローズのため入室できないが、自動リトライは行わずユーザーに判断を委ねる
            notify({
              title: "バージョン確認に失敗しました",
              description: "ページを更新してから、もう一度入室をお試しください。",
              type: "error",
            });
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
  }, [roomId, uid, room, normalizedDisplayName, isMember]);

  // ensureMember heartbeat via background interval
  useEffect(() => {
    if (!firebaseEnabled || !uid || !room || leavingRef.current) {
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
      ensureMember({ roomId, uid, displayName, clientVersion: APP_VERSION }).catch(() => void 0);
    }, ENSURE_MEMBER_MIN_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [roomId, uid, room, displayName]);

  // isHost / onlinePlayers
  const isHost = useMemo(() => room?.hostId === uid, [room?.hostId, uid]);
  const onlinePlayers = useMemo(
    () => players.filter((p) => onlineUids?.includes(p.id)),
    [players, onlineUids]
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
    detachNow: detach,
    reattachPresence: reattachNow,
    leavingRef,
  };
}
