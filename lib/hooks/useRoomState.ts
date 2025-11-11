"use client";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import { useParticipants } from "@/lib/hooks/useParticipants";
import { ensureMember, joinRoomFully } from "@/lib/services/roomService";
import { sanitizeRoom } from "@/lib/state/sanitize";
import deepEqual from "fast-deep-equal/es6";
import { logDebug, logError } from "@/lib/utils/log";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  clearSpectatorFlags,
  readAutoJoinSuppressFlag,
  readPendingRejoinFlag,
} from "@/lib/spectator/sessionFlags";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { doc, getDoc, onSnapshot, type FirestoreError } from "firebase/firestore";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { unstable_batchedUpdates } from "react-dom";
import {
  createRoomMachine,
  type RoomMachineActorRef,
  type RoomMachineClientEvent,
  type RoomMachineSnapshot,
  type SpectatorReason,
  type SpectatorRequestSource,
  type SpectatorStatus,
  type SpectatorRejoinSnapshot,
} from "@/lib/state/roomMachine";
import { createActor } from "xstate";
import {
  loadPrefetchedRoom,
  storePrefetchedRoom,
} from "@/lib/prefetch/prefetchRoomExperience";

const ROOM_SNAPSHOT_DEFER_ENABLED = process.env.NEXT_PUBLIC_PERF_ROOM_SNAPSHOT_DEFER === "1";

export type RoomState = {
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
  joinStatus?: "idle" | "joining" | "retrying" | "joined";
  phase: RoomDoc["status"];
  sendRoomEvent: (event: RoomMachineClientEvent) => void;
  spectatorStatus: SpectatorStatus;
  spectatorReason: SpectatorReason;
  spectatorRequestSource: SpectatorRequestSource;
  spectatorError: string | null;
  spectatorRequestStatus: "idle" | "pending" | "accepted" | "rejected";
  spectatorRequestCreatedAt: number | null;
  spectatorRequestFailure: string | null;
  spectatorNode: SpectatorStatus;
};

const MAX_JOIN_RETRIES = Number(process.env.NEXT_PUBLIC_ROOM_JOIN_RETRIES ?? 5);
const BASE_JOIN_RETRY_DELAY_MS = 500;
const MAX_JOIN_RETRY_DELAY_MS = Number(process.env.NEXT_PUBLIC_ROOM_JOIN_RETRY_MAX_DELAY_MS ?? 5000);
const JOIN_RETRY_BACKOFF_FACTOR = 2;

const extractPhaseFromSnapshot = (
  snapshot: RoomMachineSnapshot | null
): RoomDoc["status"] | null => {
  if (!snapshot) return null;
  const value = snapshot.value;
  if (typeof value === "string") return value as RoomDoc["status"];
  if (value && typeof value === "object") {
    const phase = (value as { phase?: unknown }).phase;
    if (typeof phase === "string") {
      return phase as RoomDoc["status"];
    }
  }
  return null;
};

const extractSpectatorNode = (
  snapshot: RoomMachineSnapshot | null
): SpectatorStatus => {
  if (!snapshot) return "idle";
  const value = snapshot.value;
  if (value && typeof value === "object" && value !== null) {
    const node = (value as { spectator?: unknown }).spectator;
    if (typeof node === "string") {
      return node as SpectatorStatus;
    }
  }
  if (typeof value === "string") {
    return value as SpectatorStatus;
  }
  return snapshot.context.spectatorStatus;
};

export function useRoomState(
  roomId: string,
  uid: string | null,
  displayName?: string | null
) {
  const [room, setRoom] = useState<(RoomDoc & { id: string }) | null>(null);
  const joinCompletedRef = useRef(false);
  const joinInFlightRef = useRef<Promise<unknown> | null>(null);
  const joinRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinAttemptRef = useRef(0);
  const membershipLogSignatureRef = useRef<string | null>(null);
  const [joinAttemptToken, setJoinAttemptToken] = useState(0);
  const [players, setPlayers] = useState<(PlayerDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [spectatorRejoinDocExists, setSpectatorRejoinDocExists] = useState<boolean | null>(null);
  const leavingRef = useRef(false);
  const [joinStatus, setJoinStatus] = useState<"idle" | "joining" | "retrying" | "joined">(
    "idle"
  );
  const prevJoinStatusRef = useRef<typeof joinStatus | null>(null);
  const prevJoinRoomStatusRef = useRef<RoomDoc["status"] | null>(null);
  const machineRef = useRef<RoomMachineActorRef | null>(null);
  const pendingMachineEventsRef = useRef<RoomMachineClientEvent[]>([]);
  const [machineSnapshot, setMachineSnapshot] = useState<RoomMachineSnapshot | null>(
    null
  );
  const currentRoomDocId = room?.id ?? null;
  const recallV2Enabled = process.env.NEXT_PUBLIC_RECALL_V2 === "1";
  const prefetchedAppliedRef = useRef(false);
  const deferEnabled = ROOM_SNAPSHOT_DEFER_ENABLED && typeof startTransition === "function";
  const [roomAccessError, setRoomAccessError] = useState<string | null>(null);
  const roomAccessStateRef = useRef<{
    state: "unknown" | "checking" | "granted" | "denied";
    retryAt: number;
  }>({ state: "unknown", retryAt: 0 });
  const roomAccessCheckRef = useRef<Promise<boolean> | null>(null);

  const enqueueCommit = useCallback(
    (task: () => void, startedAt: number | null, metricKey?: string) => {
      const runTask = () => {
        task();
        if (
          deferEnabled &&
          metricKey &&
          startedAt !== null &&
          typeof window !== "undefined" &&
          typeof performance !== "undefined"
        ) {
          window.requestAnimationFrame(() => {
            const duration = performance.now() - startedAt;
            if (duration >= 0) {
              setMetric("perf", metricKey, Math.round(duration));
            }
          });
        }
      };
      if (deferEnabled) {
        startTransition(runTask);
      } else {
        runTask();
      }
    },
    [deferEnabled]
  );

  const subscribeSpectatorRejoin = useCallback(
    ({
      roomId: targetRoomId,
      uid: targetUid,
      onSnapshot: handleSnapshot,
      onError,
    }: {
      roomId: string;
      uid: string;
      onSnapshot: (snapshot: SpectatorRejoinSnapshot) => void;
      onError?: (error: unknown) => void;
    }) => {
      if (!firebaseEnabled || !db) {
        return () => {};
      }
      try {
        const requestRef = doc(db, "rooms", targetRoomId, "rejoinRequests", targetUid);
        const unsubscribe = onSnapshot(
          requestRef,
          (snap) => {
            try {
              setSpectatorRejoinDocExists(snap.exists());
              if (!snap.exists()) {
                handleSnapshot({ exists: false });
                return;
              }
              const data = snap.data() as {
                status?: string;
                source?: string;
                createdAt?: { toMillis?: () => number } | number | null;
                reason?: string;
                failureReason?: string;
              };
              const statusRaw = typeof data?.status === "string" ? data.status : "pending";
              const status: "pending" | "accepted" | "rejected" =
                statusRaw === "accepted" || statusRaw === "rejected" ? statusRaw : "pending";
              const sourceRaw = typeof data?.source === "string" ? data.source : "manual";
              const source: Exclude<SpectatorRequestSource, null> =
                sourceRaw === "auto" ? "auto" : "manual";
              const createdAtSource = data?.createdAt;
              let createdAt: number | null = null;
              if (
                createdAtSource &&
                typeof createdAtSource === "object" &&
                typeof (createdAtSource as { toMillis?: () => number }).toMillis === "function"
              ) {
                createdAt = Number(
                  (createdAtSource as { toMillis: () => number }).toMillis()
                );
              } else if (typeof createdAtSource === "number") {
                createdAt = createdAtSource;
              }
              const failure =
                typeof data?.reason === "string"
                  ? data.reason
                  : typeof data?.failureReason === "string"
                  ? data.failureReason
                  : null;
              handleSnapshot({
                exists: true,
                status,
                source,
                createdAt: createdAt ?? null,
                failure,
              });
            } catch (error) {
              onError?.(error);
            }
          },
          (error) => {
            onError?.(error);
          }
        );
        return () => {
          unsubscribe();
        };
      } catch (error) {
        onError?.(error);
        return () => {};
      }
    },
    [setSpectatorRejoinDocExists]
  );
  const spectatorRejoinSubscription = firebaseEnabled ? subscribeSpectatorRejoin : undefined;

  const normalizedDisplayName = useMemo(() => {
    if (typeof displayName === "string") {
      const trimmed = displayName.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return null;
  }, [displayName]);

  const playerIds = useMemo(() => players.map((p) => p.id), [players]);
  const playerIdsSignature = useMemo(() => playerIds.join(","), [playerIds]);
  const uidStable = uid ?? "";

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
    if (currentRoomDocId === roomId) {
      return;
    }
    prefetchedAppliedRef.current = true;
    const startedAt = typeof performance !== "undefined" ? performance.now() : null;
    enqueueCommit(() => {
      prefetchedAppliedRef.current = true;
      setRoom({ id: roomId, ...(cached as RoomDoc) });
      setLoading(false);
    }, startedAt);
  }, [roomId, currentRoomDocId, enqueueCommit]);

  // reset leaving flag & join state when room/user changes
  useEffect(() => {
    setSpectatorRejoinDocExists(null);
  }, [roomId, uid]);

  useEffect(() => {
    leavingRef.current = false;
    joinCompletedRef.current = false;
    joinInFlightRef.current = null;
    joinAttemptRef.current = 0;
    if (joinRetryTimerRef.current) {
      clearTimeout(joinRetryTimerRef.current);
      joinRetryTimerRef.current = null;
    }
  }, [roomId, uidStable]);

  useEffect(() => () => {
    if (joinRetryTimerRef.current) {
      clearTimeout(joinRetryTimerRef.current);
      joinRetryTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const actor = createActor(
      createRoomMachine({
        roomId,
        room: null,
        players: [],
        onlineUids: undefined,
        presenceReady: false,
        viewerUid: uid ?? null,
        deps: {
          subscribeSpectatorRejoin: spectatorRejoinSubscription,
        },
      })
    );
    actor.start();
    setMachineSnapshot(actor.getSnapshot());
    const subscription = actor.subscribe((snapshot) => {
      setMachineSnapshot(snapshot);
    });
    if (machineRef.current) {
      machineRef.current.stop();
    }
    machineRef.current = actor;
    if (pendingMachineEventsRef.current.length > 0) {
      const pendingEvents = pendingMachineEventsRef.current.slice();
      pendingMachineEventsRef.current = [];
      for (const pendingEvent of pendingEvents) {
        actor.send(pendingEvent);
      }
    }

    return () => {
      subscription.unsubscribe();
      actor.stop();
      if (machineRef.current === actor) {
        machineRef.current = null;
      }
    };
  }, [roomId, uid, spectatorRejoinSubscription]);

  // subscribe room
  useEffect(() => {
    if (!firebaseEnabled) {
      return () => {};
    }
    if (!roomId) {
      const startedAt = typeof performance !== "undefined" ? performance.now() : null;
      enqueueCommit(() => {
        setRoom(null);
        setLoading(false);
        prefetchedAppliedRef.current = false;
      }, startedAt);
      return () => {};
    }

    const unsubRef = { current: null as null | (() => void) };
    const backoffUntilRef = { current: 0 };
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;
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

    const scheduleRetry = (delayMs: number) => {
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
          scheduleRetry(5000);
          return;
        }
        unsubRef.current = onSnapshot(
          doc(db!, "rooms", roomId),
          (snap) => {
            const receivedAt =
              typeof performance !== "undefined" ? performance.now() : null;
            if (!snap.exists()) {
              enqueueCommit(() => {
                prevRoomSnapshot = { id: null, data: null };
                setRoom(null);
                storePrefetchedRoom(roomId, null);
                prefetchedAppliedRef.current = false;
              }, receivedAt, "roomSnapshotCommitMs");
              return;
            }

            const rawData = snap.data();
            const sanitized = sanitizeRoom(rawData);
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
              storePrefetchedRoom(
                roomId,
                sanitized as unknown as Record<string, unknown>
              );
              prefetchedAppliedRef.current = false;
              setRoomAccessError(null);
              roomAccessStateRef.current = { state: "granted", retryAt: 0 };
            }, receivedAt, "roomSnapshotCommitMs");
          },
          (err) => {
            if (isFirebaseQuotaExceeded(err)) {
              handleFirebaseQuotaError("ルーム購読");
              stop();
              scheduleRetry(5 * 60 * 1000);
              return;
            }
            const code =
              (err as FirestoreError)?.code ??
              (err as { code?: string }).code ??
              null;
            if (code === "permission-denied") {
              roomAccessStateRef.current = {
                state: "denied",
                retryAt: Date.now() + 5000,
              };
              setRoomAccessError("permission-denied");
              stop();
              scheduleRetry(5000);
              return;
            }
            const errorAt =
              typeof performance !== "undefined" ? performance.now() : null;
            enqueueCommit(() => {
              setRoom(null);
              storePrefetchedRoom(roomId, null);
              prefetchedAppliedRef.current = false;
            }, errorAt, "roomSnapshotCommitMs");
            scheduleRetry(2000);
          }
        );
      };
      start().catch((error) => {
        traceError("room.snapshot.start", error, { roomId });
        scheduleRetry(2000);
      });
    };

    // 初回は1フレーム遅延して購読（フラグON時）
    if (process.env.NEXT_PUBLIC_PERF_WARMUP === "1") {
      try {
        requestAnimationFrame(() => {
          try {
            maybeStart();
            setMetric("perf", "warmup.watch", 1);
            traceAction("warmup.watch");
          } catch (e) {
            traceError("warmup.watch", e);
          }
        });
      } catch {
        maybeStart();
      }
    } else {
      // 既定の即時購読
      maybeStart();
    }

    return () => {
      if (backoffTimer) {
        try {
          clearTimeout(backoffTimer);
        } catch {}
      }
      roomAccessStateRef.current = { state: "unknown", retryAt: 0 };
      roomAccessCheckRef.current = null;
      stop();
    };
  }, [roomId, enqueueCommit]);

  // メモ化の最適化: playersの変更を正確に検知
  const isMember = useMemo(
    () => !!(uid && players.some((p) => p.id === uid)),
    [uid, players]
  );
  const prevMembershipRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!uid || !roomId) {
      prevMembershipRef.current = null;
      return;
    }
    if (prevMembershipRef.current === isMember) return;
    prevMembershipRef.current = isMember;
    traceAction("membership.state", {
      roomId,
      uid,
      isMember,
      joinStatus,
      players: playerIds,
    });
  }, [roomId, uid, isMember, playerIds, joinStatus]);

  useEffect(() => {
    if (!isMember) {
      joinCompletedRef.current = false;
    } else {
      joinAttemptRef.current = 0;
      if (joinRetryTimerRef.current) {
        clearTimeout(joinRetryTimerRef.current);
        joinRetryTimerRef.current = null;
      }
    }
    if (isMember) {
      setJoinStatus("joined");
    }
  }, [isMember]);

  // participants: Firestore players + RTDB presence
  const {
    players: fetchedPlayers,
    onlineUids: effectiveOnlineUids,
    stableOnlineUids,
    presenceReady,
    presenceDegraded,
    participants,
    detach,
    reattachNow,
    loading: partLoading,
  } = useParticipants(roomId, uid || null);
  const onlineUids = effectiveOnlineUids;
  const presenceOperational = presenceReady || presenceDegraded;
  useEffect(() => {
    const startedAt = typeof performance !== "undefined" ? performance.now() : null;
    enqueueCommit(() => {
      unstable_batchedUpdates(() => {
        setPlayers(fetchedPlayers);
        setLoading(partLoading === true);
      });
    }, startedAt, "participantsCommitMs");
  }, [fetchedPlayers, partLoading, enqueueCommit]);

  useEffect(() => {
    const actor = machineRef.current;
    if (!actor) return;
    actor.send({
      type: "SYNC",
      room,
      players,
      onlineUids,
      presenceReady: presenceOperational,
    });
  }, [room, players, onlineUids, presenceOperational]);

  const rejoinSessionKey = useMemo(
    () => (uid ? `pendingRejoin:${roomId}` : null),
    [roomId, uid]
  );
  const autoJoinSuppressKey = useMemo(
    () => (uid ? `autoJoinSuppress:${roomId}:${uid}` : null),
    [roomId, uid]
  );
  // auto-join
  // V2: 待機中のみ自動参加。ゲーム中の途中参加は禁止。
  // V3(Recall V2 有効時): 観戦→復帰は rejoinRequests 経由に統一するため、
  // 非メンバーの自動参加は行わない（観戦UIの「席に戻る」からのみ参加）。
  useEffect(() => {
    if (!firebaseEnabled) return;
    if (!uid || !room) return;
    if (leavingRef.current) return;
    if (!normalizedDisplayName) return;

    // Spectator V3:
    // - 原則: 観戦→復帰は rejoinRequests 経由（page.tsx 側で実装）
    // - 例外: 初回/一般参加（waiting かつ recallOpen が閉じられていない場合）は従来どおり自動参加を許可
    let pendingRejoin = readPendingRejoinFlag({
      rejoinSessionKey,
      uid,
    });
    const rejoinDocState = spectatorRejoinDocExists;
    if (pendingRejoin && rejoinDocState === false && uid && rejoinSessionKey) {
      const { pendingCleared } = clearSpectatorFlags({
        roomId,
        uid,
        rejoinSessionKey,
        autoJoinSuppressKey,
      });
      if (pendingCleared) {
        pendingRejoin = false;
      }
    }
    const activeRejoinIntent =
      pendingRejoin && (rejoinDocState === null || rejoinDocState === true);

    const autoJoinSuppressed = readAutoJoinSuppressFlag(autoJoinSuppressKey);

    const clearPending = () => {
      if (!pendingRejoin || !uid) return;
      clearSpectatorFlags({
        roomId,
        uid,
        rejoinSessionKey,
        autoJoinSuppressKey,
      });
    };

    const clearRetryTimer = () => {
      if (joinRetryTimerRef.current) {
        clearTimeout(joinRetryTimerRef.current);
        joinRetryTimerRef.current = null;
      }
    };

    if (room.status === "waiting") {
      if (recallV2Enabled && !isMember) {
      const allowDirectJoin = !activeRejoinIntent;
        if (!allowDirectJoin) {
          joinAttemptRef.current = 0;
          clearRetryTimer();
          setJoinStatus("idle");
          return;
        }
      }
      if (!pendingRejoin && !isMember && autoJoinSuppressed) {
        joinAttemptRef.current = 0;
        clearRetryTimer();
        setJoinStatus("idle");
        return;
      }
      if (pendingRejoin) {
        joinCompletedRef.current = false;
        joinAttemptRef.current = 0;
      }

      const alreadyJoined = joinCompletedRef.current && isMember;
      if (!pendingRejoin) {
        if (alreadyJoined) {
          clearRetryTimer();
          return;
        }
        if (joinInFlightRef.current) {
          return;
        }
      }

      clearRetryTimer();
      const attemptBeforeCall = joinAttemptRef.current;
    logDebug("room-state", "joinRoomFully-attempt", {
        roomId,
        uid,
        status: room.status,
        pendingRejoin,
        attempt: attemptBeforeCall + 1,
        normalizedDisplayNameProvided: normalizedDisplayName !== null,
        players: playerIds,
      });
      const joinTask = joinRoomFully({
        roomId,
        uid,
        displayName: normalizedDisplayName,
        notifyChat: !pendingRejoin,
      })
        .then(() => {
          logDebug("room-state", "joinRoomFully-success", {
            roomId,
            uid,
            status: room.status,
            pendingRejoin,
            attempt: attemptBeforeCall + 1,
          });
          joinCompletedRef.current = true;
          joinAttemptRef.current = 0;
          clearRetryTimer();
          setJoinStatus("joined");
          clearPending();
        })
        .catch((error) => {
          joinCompletedRef.current = false;
          const nextAttempt = attemptBeforeCall + 1;
          joinAttemptRef.current = nextAttempt;
          const cappedAttempt = Math.min(Math.max(nextAttempt, 1), MAX_JOIN_RETRIES);
          const delay = Math.min(
            BASE_JOIN_RETRY_DELAY_MS *
              Math.pow(JOIN_RETRY_BACKOFF_FACTOR, Math.max(cappedAttempt - 1, 0)),
            MAX_JOIN_RETRY_DELAY_MS
          );
          const shouldRetry = pendingRejoin || nextAttempt <= MAX_JOIN_RETRIES;
          if (shouldRetry) {
            logDebug("room-state", "joinRoomFully-retry", {
              attempt: nextAttempt,
              delay,
              pendingRejoin,
              status: room.status,
            });
            clearRetryTimer();
            joinRetryTimerRef.current = setTimeout(() => {
              joinRetryTimerRef.current = null;
              setJoinAttemptToken((value) => value + 1);
            }, delay);
            setJoinStatus("retrying");
          } else {
            logError("room-state", "joinRoomFully-max-retries", {
              error,
              roomId,
              uid,
              status: room.status,
              pendingRejoin,
              attempt: nextAttempt,
            });
            setJoinStatus("retrying");
            clearPending();
          }
        })
        .finally(() => {
          joinInFlightRef.current = null;
        });

      joinInFlightRef.current = joinTask;
      setJoinStatus("joining");
      joinTask.catch(() => void 0);
    } else if (isMember) {
      joinAttemptRef.current = 0;
      clearRetryTimer();
      ensureMember({ roomId, uid, displayName: normalizedDisplayName }).catch(
        () => void 0
      );
      setJoinStatus("joined");
    } else {
      joinAttemptRef.current = 0;
      clearRetryTimer();
      setJoinStatus("idle");
    }
  }, [
    roomId,
    uid,
    room,
    normalizedDisplayName,
    rejoinSessionKey,
    isMember,
    joinAttemptToken,
    recallV2Enabled,
    spectatorRejoinDocExists,
    autoJoinSuppressKey,
    playerIdsSignature,
    playerIds,
    loading,
  ]);
  useEffect(() => {
    if (!rejoinSessionKey || typeof window === "undefined") return;
    if (isMember) {
      try {
        window.sessionStorage.removeItem(rejoinSessionKey);
      } catch {}
    }
  }, [isMember, rejoinSessionKey]);

  const onlinePlayers = participants;

  const isHost = useMemo(
    () => !!(room && uid && room.hostId === uid),
    [room, uid]
  );
  useEffect(() => {
    if (!firebaseEnabled) return;
    if (!roomId || !uid) return;
    if (!room) {
      membershipLogSignatureRef.current = null;
      return;
    }
    if (room.status !== "waiting") {
      membershipLogSignatureRef.current = null;
      return;
    }
    if (isMember) {
      if (membershipLogSignatureRef.current !== null) {
        logDebug("room-state", "waiting-membership-resolved", {
          roomId,
          uid,
          players: playerIds,
        });
      }
      membershipLogSignatureRef.current = null;
      return;
    }
    const signature = [
      uid,
      playerIdsSignature,
      joinStatus,
      joinAttemptRef.current,
      joinCompletedRef.current ? "1" : "0",
      joinInFlightRef.current ? "1" : "0",
    ].join("|");
    if (membershipLogSignatureRef.current === signature) {
      return;
    }
    membershipLogSignatureRef.current = signature;
    logDebug("room-state", "waiting-membership-missing", {
      roomId,
      uid,
      players: playerIds,
      joinStatus,
    joinAttempt: joinAttemptRef.current,
    joinCompleted: joinCompletedRef.current,
    joinInFlight: !!joinInFlightRef.current,
  });
  }, [
    room,
    roomId,
    uid,
    isMember,
    playerIdsSignature,
    playerIds,
    joinStatus,
  ]);

  const effectivePhase = useMemo<RoomDoc["status"]>(() => {
    const phaseState = extractPhaseFromSnapshot(machineSnapshot);
    if (phaseState) {
      return phaseState;
    }
    return room?.status ?? "waiting";
  }, [machineSnapshot, room?.status]);

  const effectiveRoom = useMemo<(RoomDoc & { id: string }) | null>(() => {
    if (!room) return null;
    const statusFromMachine = extractPhaseFromSnapshot(machineSnapshot);
    if (!statusFromMachine || statusFromMachine === room.status) {
      return room;
    }
    return { ...room, status: statusFromMachine };
  }, [room, machineSnapshot]);

  const spectatorState = useMemo<{
    spectatorStatus: SpectatorStatus;
    spectatorReason: SpectatorReason;
    spectatorRequestSource: SpectatorRequestSource;
    spectatorError: string | null;
    spectatorRequestStatus: "idle" | "pending" | "accepted" | "rejected";
    spectatorRequestCreatedAt: number | null;
    spectatorRequestFailure: string | null;
    spectatorNode: SpectatorStatus;
  }>(() => {
    const snapshot = machineSnapshot;
    if (!snapshot) {
      return {
        spectatorStatus: "idle",
        spectatorReason: null,
        spectatorRequestSource: null,
        spectatorError: null,
        spectatorRequestStatus: "idle",
        spectatorRequestCreatedAt: null,
        spectatorRequestFailure: null,
        spectatorNode: "idle",
      };
    }
    const spectatorNode = extractSpectatorNode(snapshot);
    return {
      spectatorStatus: snapshot.context.spectatorStatus,
      spectatorReason: snapshot.context.spectatorReason,
      spectatorRequestSource: snapshot.context.spectatorRequestSource,
      spectatorError: snapshot.context.spectatorError,
      spectatorRequestStatus: snapshot.context.spectatorRequestStatus,
      spectatorRequestCreatedAt: snapshot.context.spectatorRequestCreatedAt,
      spectatorRequestFailure: snapshot.context.spectatorRequestFailure,
      spectatorNode,
    };
  }, [machineSnapshot]);

  const sendRoomEvent = useCallback(
    (event: RoomMachineClientEvent) => {
      const actor = machineRef.current;
      if (actor) {
        actor.send(event);
        return;
      }
      pendingMachineEventsRef.current.push(event);
    },
    []
  );

  // メモ化されたstateオブジェクトで不必要な再レンダリングを防ぐ
  const state: RoomState = useMemo(
    () => ({
      room: effectiveRoom,
      players,
      loading,
      onlineUids,
      stableOnlineUids,
      presenceReady: presenceOperational,
      presenceDegraded,
      onlinePlayers,
      isMember,
      isHost,
      phase: effectivePhase,
      sendRoomEvent,
      spectatorStatus: spectatorState.spectatorStatus,
      spectatorReason: spectatorState.spectatorReason,
      spectatorRequestSource: spectatorState.spectatorRequestSource,
      spectatorError: spectatorState.spectatorError,
      spectatorRequestStatus: spectatorState.spectatorRequestStatus,
      spectatorRequestCreatedAt: spectatorState.spectatorRequestCreatedAt,
      spectatorRequestFailure: spectatorState.spectatorRequestFailure,
      spectatorNode: spectatorState.spectatorNode,
      roomAccessError,
    }),
    [
      effectiveRoom,
      players,
      loading,
      onlineUids,
      stableOnlineUids,
      presenceOperational,
      presenceDegraded,
      onlinePlayers,
      isMember,
      isHost,
      effectivePhase,
      sendRoomEvent,
      spectatorState.spectatorStatus,
      spectatorState.spectatorReason,
      spectatorState.spectatorRequestSource,
      spectatorState.spectatorError,
      spectatorState.spectatorRequestStatus,
      spectatorState.spectatorRequestCreatedAt,
      spectatorState.spectatorRequestFailure,
      spectatorState.spectatorNode,
      roomAccessError,
    ]
  );

  const detachNow = detach;
  const reattachPresence = reattachNow;
  useEffect(() => {
    const previousStatus = prevJoinStatusRef.current;
    const previousRoomStatus = prevJoinRoomStatusRef.current;
    if (previousStatus === joinStatus && previousRoomStatus === room?.status) {
      return;
    }
    prevJoinStatusRef.current = joinStatus;
    prevJoinRoomStatusRef.current = room?.status ?? null;
    traceAction("room.joinStatus", {
      roomId,
      uid,
      joinStatus,
      roomStatus: room?.status ?? null,
      isMember,
    });
  }, [roomId, uid, joinStatus, room?.status, isMember]);
  return {
    ...state,
    detachNow,
    reattachPresence,
    leavingRef,
    joinStatus,
  } as const;
}
