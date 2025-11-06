"use client";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import { useParticipants } from "@/lib/hooks/useParticipants";
import { ensureMember, joinRoomFully } from "@/lib/services/roomService";
import { sanitizeRoom } from "@/lib/state/sanitize";
import deepEqual from "fast-deep-equal/es6";
import { logDebug, logError } from "@/lib/utils/log";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { clearSpectatorFlags } from "@/lib/spectator/sessionFlags";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { doc, onSnapshot } from "firebase/firestore";
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
  const membershipRetryAtRef = useRef(0);
  const membershipLogSignatureRef = useRef<string | null>(null);
  const [joinAttemptToken, setJoinAttemptToken] = useState(0);
  const [players, setPlayers] = useState<(PlayerDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [spectatorRejoinDocExists, setSpectatorRejoinDocExists] = useState<boolean | null>(null);
  const leavingRef = useRef(false);
  const [joinStatus, setJoinStatus] = useState<"idle" | "joining" | "retrying" | "joined">(
    "idle"
  );
  const machineRef = useRef<RoomMachineActorRef | null>(null);
  const pendingMachineEventsRef = useRef<RoomMachineClientEvent[]>([]);
  const [machineSnapshot, setMachineSnapshot] = useState<RoomMachineSnapshot | null>(
    null
  );
  const recallV2Enabled = process.env.NEXT_PUBLIC_RECALL_V2 === "1";
  const prefetchedAppliedRef = useRef(false);
  const deferEnabled = ROOM_SNAPSHOT_DEFER_ENABLED && typeof startTransition === "function";

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
              const data = snap.data() as Record<string, any>;
              const statusRaw = typeof data?.status === "string" ? data.status : "pending";
              const status: "pending" | "accepted" | "rejected" =
                statusRaw === "accepted" || statusRaw === "rejected" ? statusRaw : "pending";
              const sourceRaw = typeof data?.source === "string" ? data.source : "manual";
              const source: Exclude<SpectatorRequestSource, null> =
                sourceRaw === "auto" ? "auto" : "manual";
              const createdAt =
                typeof data?.createdAt?.toMillis === "function"
                  ? Number(data.createdAt.toMillis())
              : typeof data?.createdAt === "number"
              ? data.createdAt
              : null;
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
    [db, firebaseEnabled, setSpectatorRejoinDocExists]
  );

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
      setLoading(false);
    }, startedAt);
  }, [roomId, room?.id, enqueueCommit]);

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
  }, [roomId, uid || ""]);

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
          subscribeSpectatorRejoin: firebaseEnabled ? subscribeSpectatorRejoin : undefined,
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
  }, [roomId, uid, firebaseEnabled, subscribeSpectatorRejoin]);

  // subscribe room
  useEffect(() => {
    if (!firebaseEnabled) {
      return;
    }
    if (!roomId) {
      const startedAt = typeof performance !== "undefined" ? performance.now() : null;
      enqueueCommit(() => {
        setRoom(null);
        setLoading(false);
        prefetchedAppliedRef.current = false;
      }, startedAt);
      return;
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

    const maybeStart = () => {
      if (unsubRef.current) return; // already subscribed
      const now = Date.now();
      if (now < backoffUntilRef.current) return; // still backing off
      unsubRef.current = onSnapshot(
        doc(db!, "rooms", roomId),
        (snap) => {
          const receivedAt = typeof performance !== "undefined" ? performance.now() : null;
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
            storePrefetchedRoom(roomId, sanitized as unknown as Record<string, unknown>);
            prefetchedAppliedRef.current = false;
          }, receivedAt, "roomSnapshotCommitMs");
        },
        (err) => {
          if (isFirebaseQuotaExceeded(err)) {
            handleFirebaseQuotaError("ルーム購読");
            backoffUntilRef.current = Date.now() + 5 * 60 * 1000; // 5分バックオフ
            stop();
            if (backoffTimer) {
              try {
                clearTimeout(backoffTimer);
              } catch {}
              backoffTimer = null;
            }
            // 可視時にのみ自動再開を試みる
            const resume = () => {
              if (
                typeof document !== "undefined" &&
                document.visibilityState !== "visible"
              )
                return;
              const remain = backoffUntilRef.current - Date.now();
              if (remain > 0) {
                backoffTimer = setTimeout(resume, Math.min(remain, 30_000));
              } else {
                maybeStart();
              }
            };
            resume();
          } else {
            // その他のエラー時は一旦nullに
            const errorAt = typeof performance !== "undefined" ? performance.now() : null;
            enqueueCommit(() => {
              setRoom(null);
              storePrefetchedRoom(roomId, null);
              prefetchedAppliedRef.current = false;
            }, errorAt, "roomSnapshotCommitMs");
          }
        }
      );
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
            traceError("warmup.watch", e as any);
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
      players: players.map((p) => p.id),
    });
  }, [roomId, uid, isMember, players, joinStatus]);

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
    if (!displayName || !String(displayName).trim()) return;

    // Spectator V3:
    // - 原則: 観戦→復帰は rejoinRequests 経由（page.tsx 側で実装）
    // - 例外: 初回/一般参加（waiting かつ recallOpen が閉じられていない場合）は従来どおり自動参加を許可
    let pendingRejoin = false;
    if (rejoinSessionKey && typeof window !== "undefined") {
      try {
        const stored = window.sessionStorage.getItem(rejoinSessionKey);
        if (stored !== null) {
          pendingRejoin = stored === uid;
        }
      } catch {}
    }
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

    let autoJoinSuppressed = false;
    if (autoJoinSuppressKey && typeof window !== "undefined") {
      try {
        autoJoinSuppressed =
          window.sessionStorage.getItem(autoJoinSuppressKey) === "1";
      } catch {}
    }

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
        const status = (room as any)?.status as string | undefined;
        const recallOpenValue = (room as any)?.ui?.recallOpen as boolean | undefined;
        const isRejoinIntent = pendingRejoin;
        const allowDirectJoin =
          status === "waiting" &&
          (!activeRejoinIntent || recallOpenValue !== false);
        const allowFromIntent = isRejoinIntent && !autoJoinSuppressed;
        if (!allowDirectJoin && !allowFromIntent) {
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
      const normalizedDisplayName =
        typeof displayName === "string" && displayName.trim().length > 0
          ? displayName.trim()
          : null;
      logDebug("room-state", "joinRoomFully-attempt", {
        roomId,
        uid,
        status: room.status,
        pendingRejoin,
        attempt: attemptBeforeCall + 1,
        normalizedDisplayNameProvided: normalizedDisplayName !== null,
        players: players.map((p) => p.id),
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
      const normalizedDisplayName =
        typeof displayName === "string" && displayName.trim().length > 0
          ? displayName.trim()
          : null;
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
    uid || "",
    room?.status,
    displayName || "",
    rejoinSessionKey,
    isMember,
    joinAttemptToken,
    recallV2Enabled,
    spectatorRejoinDocExists,
    autoJoinSuppressKey,
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
    [room?.hostId, uid]
  );

  useEffect(() => {
    if (!firebaseEnabled) return;
    if (!uid || !room) return;
    if (!isHost && room.status !== "waiting") return;
    if (loading) return;
    if (leavingRef.current) return;

    if (isMember) {
      membershipRetryAtRef.current = 0;
      return;
    }

    if (joinInFlightRef.current) {
      return;
    }

    const now = Date.now();
    if (
      membershipRetryAtRef.current &&
      now - membershipRetryAtRef.current < 1500
    ) {
      return;
    }

    membershipRetryAtRef.current = now;
    joinCompletedRef.current = false;
    setJoinAttemptToken((value) => value + 1);
    setJoinStatus("joining");
  }, [
    firebaseEnabled,
    loading,
    isMember,
    room?.status,
    uid,
    room,
    isHost,
    roomId,
  ]);
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
          players: players.map((p) => p.id),
        });
      }
      membershipLogSignatureRef.current = null;
      return;
    }
    const signature = [
      uid,
      players.map((p) => p.id).join(","),
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
      players: players.map((p) => p.id),
      joinStatus,
    joinAttempt: joinAttemptRef.current,
    joinCompleted: joinCompletedRef.current,
    joinInFlight: !!joinInFlightRef.current,
  });
  }, [
    firebaseEnabled,
    room,
    roomId,
    uid,
    isMember,
    players,
    joinStatus,
  ]);

  const effectivePhase = useMemo<RoomDoc["status"]>(() => {
    const snapshot = machineSnapshot;
    if (!snapshot) {
      return room?.status ?? "waiting";
    }
    const rawValue = snapshot.value as any;
    let phaseState: RoomDoc["status"] | null = null;
    if (typeof rawValue === "string") {
      phaseState = rawValue as RoomDoc["status"];
    } else if (rawValue && typeof rawValue === "object" && typeof rawValue.phase === "string") {
      phaseState = rawValue.phase as RoomDoc["status"];
    }
    return phaseState ?? room?.status ?? "waiting";
  }, [machineSnapshot, room?.status]);

  const effectiveRoom = useMemo<(RoomDoc & { id: string }) | null>(() => {
    if (!room) return null;
    const snapshot = machineSnapshot;
    if (!snapshot) return room;
    const rawValue = snapshot.value as any;
    let statusFromMachine: RoomDoc["status"] | null = null;
    if (typeof rawValue === "string") {
      statusFromMachine = rawValue as RoomDoc["status"];
    } else if (rawValue && typeof rawValue === "object" && typeof rawValue.phase === "string") {
      statusFromMachine = rawValue.phase as RoomDoc["status"];
    }
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
    const rawValue = snapshot.value as any;
    let spectatorNode: SpectatorStatus = snapshot.context.spectatorStatus;
    if (typeof rawValue === "object" && rawValue !== null && typeof rawValue.spectator === "string") {
      spectatorNode = rawValue.spectator as SpectatorStatus;
    } else if (typeof rawValue === "string") {
      spectatorNode = rawValue as SpectatorStatus;
    }
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
    ]
  );

  const detachNow = detach;
  const reattachPresence = reattachNow;
  return {
    ...state,
    detachNow,
    reattachPresence,
    leavingRef,
    joinStatus,
  } as const;
}
