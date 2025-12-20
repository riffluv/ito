"use client";
import { PRESENCE_DISAPPEAR_GRACE_MS } from "@/lib/constants/uiTimings";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import { playerConverter } from "@/lib/firebase/converters";
import {
  attachPresence,
  presenceSupported,
  subscribePresence,
} from "@/lib/firebase/presence";
import {
  deriveStableOnlineUids,
  type MissingSinceStore,
} from "@/lib/presence/stableOnline";
import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_HEARTBEAT_RETRY_DELAYS_MS,
} from "@/lib/constants/presence";
import type { PlayerDoc } from "@/lib/types";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { logDebug } from "@/lib/utils/log";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";
import { scheduleIdleTask } from "@/lib/utils/idleScheduler";
import { traceAction } from "@/lib/utils/trace";
import { reportOpsEvent } from "@/lib/telemetry/opsMonitoring";
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  type FirestoreError,
} from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { unstable_batchedUpdates } from "react-dom";

export type ParticipantsState = {
  players: (PlayerDoc & { id: string })[];
  onlineUids?: string[]; // presence 未整備時は undefined（安定化済み）
  stableOnlineUids?: string[];
  presenceReady: boolean;
  presenceDegraded: boolean;
  participants: (PlayerDoc & { id: string })[]; // players ∩ online
  detach: () => Promise<void> | void; // 明示的退出時に使用
  reattachNow: () => Promise<void>; // 観戦→復帰などで presence を再接続
  loading: boolean;
  error: Error | null;
};

const createPlayersSignature = (list: readonly (PlayerDoc & { id: string })[]) => {
  if (!list.length) return "";
  return list
    .map((player) => {
      const ready = player.ready ? "1" : "0";
      const number = typeof player.number === "number" ? player.number : "_";
      const order = typeof player.orderIndex === "number" ? player.orderIndex : "_";
      const clue = typeof player.clue1 === "string" ? player.clue1 : "";
      return `${player.id}|${ready}|${number}|${order}|${clue}`;
    })
    .join(";");
};

const isPromiseLike = <T = unknown>(value: unknown): value is Promise<T> => {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as Promise<T>).then === "function" &&
    "catch" in value &&
    typeof (value as Promise<T>).catch === "function"
  );
};

declare global {
  interface Window {
    /**
     * ルームIDごとの「offline検知時刻」キャッシュ
     * window.__missingSince[roomId][uid] = timestamp
     */
    __missingSince?: Record<string, Record<string, number>>;
  }
}

const readMissingSinceStore = (
  roomId?: string | null
): MissingSinceStore => {
  if (typeof window === "undefined" || !roomId) return {};
  try {
    const roomStore = window.__missingSince?.[roomId];
    if (roomStore && typeof roomStore === "object") {
      return Object.entries(roomStore).reduce<MissingSinceStore>(
        (acc, [uid, ts]) => {
          if (typeof ts === "number" && Number.isFinite(ts)) {
            acc[uid] = ts;
          }
          return acc;
        },
        {}
      );
    }
  } catch {}
  return {};
};

const writeMissingSinceStore = (roomId: string, store: MissingSinceStore) => {
  if (typeof window === "undefined" || !roomId) return;
  try {
    if (!window.__missingSince) {
      window.__missingSince = {};
    }
    window.__missingSince[roomId] = { ...store };
  } catch {}
};

export function useParticipants(
  roomId: string,
  uid: string | null
): ParticipantsState {
  const [players, setPlayers] = useState<(PlayerDoc & { id: string })[]>([]);
  const [onlineUids, setOnlineUids] = useState<string[] | undefined>(undefined);
  const onlineUidsSignatureRef = useRef<string | null>(null);
  const [stableOnlineUids, setStableOnlineUids] = useState<string[] | undefined>(
    undefined
  );
  const stableOnlineUidsRef = useRef<string[] | undefined>(undefined);
  const [presenceReady, setPresenceReady] = useState(false);
  const [presenceDegraded, setPresenceDegraded] = useState(false);
  const lastPresenceDegradedRef = useRef<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const detachRef = useRef<null | (() => Promise<void> | void)>(null);
  const activePresenceRef = useRef<{ roomId: string | null; uid: string | null }>({
    roomId: null,
    uid: null,
  });
  const attachRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reattachTriggerRef = useRef<(() => void) | null>(null);
  const playersRef = useRef<(PlayerDoc & { id: string })[]>([]);
  const playersSignatureRef = useRef<string>("");
  const presenceStallTimerRef = useRef<number | null>(null);

  // Firestore: players 購読（タブ非表示時は遅延開始、429時はバックオフ）
  useEffect(() => {
    const unsubRef = { current: null as null | (() => void) };
    const backoffUntilRef = { current: 0 };
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;

    const visibilityCleanupRef = { current: null as null | (() => void) };
    let startVisibilityCleanup: null | (() => void) = null;

    const detachVisibilityListener = () => {
      if (typeof document === "undefined") return;
      if (visibilityCleanupRef.current) {
        visibilityCleanupRef.current();
        visibilityCleanupRef.current = null;
      }
    };

    const detachStartVisibility = () => {
      startVisibilityCleanup?.();
      startVisibilityCleanup = null;
    };

    const stop = () => {
      try {
        unsubRef.current?.();
      } catch {}
      unsubRef.current = null;
      detachVisibilityListener();
    };

    const cleanup = () => {
      if (backoffTimer) {
        try {
          clearTimeout(backoffTimer);
        } catch {}
      }
      stop();
      detachVisibilityListener();
      detachStartVisibility();
      cancelIdleStart?.();
    };

    if (!firebaseEnabled || !roomId) {
      return cleanup;
    }

    setLoading(true);
    setError(null);

    let cancelIdleStart: (() => void) | null = null;

    const applyPlayersSnapshot = (docs: Array<{ data: () => PlayerDoc; id: string }>) => {
      const working = docs.map((doc) => ({ ...(doc.data() as PlayerDoc), id: doc.id }));
      const signature = createPlayersSignature(working);
      const previousSignature = playersSignatureRef.current;
      const shouldUpdatePlayers = signature !== previousSignature;
      if (shouldUpdatePlayers) {
        playersRef.current = working;
        playersSignatureRef.current = signature;
      }
      unstable_batchedUpdates(() => {
        if (shouldUpdatePlayers) {
          setPlayers(working);
        }
        setLoading(false);
      });
      setMetric("participants", "lastSnapshotTs", Date.now());
      setMetric("participants", "playersCount", working.length);
    };

    const maybeStart = () => {
      if (unsubRef.current) return;
      const now = Date.now();
      if (now < backoffUntilRef.current) return;
      bumpMetric("participants", "subscribeAttempts");
      unsubRef.current = onSnapshot(
        query(
          collection(db!, "rooms", roomId, "players").withConverter(
            playerConverter
          ),
          orderBy("uid", "asc")
        ),
        (snap) => {
          const changes = snap.docChanges();
          let working =
            playersRef.current.length > 0 ? playersRef.current.slice() : [];

          // 初回スナップショットなど、全件 added の場合は一度リストを作り直す
          const fullReset =
            !snap.metadata.hasPendingWrites &&
            changes.length > 0 &&
            changes.length === snap.size;

          if (fullReset || (changes.length === 0 && !snap.metadata.hasPendingWrites)) {
            working = snap.docs.map((doc) => ({
              ...(doc.data() as PlayerDoc),
              id: doc.id,
            }));
          } else {
            for (const change of changes) {
              const payload = {
                ...(change.doc.data() as PlayerDoc),
                id: change.doc.id,
              };
              if (change.type === "added") {
                const index =
                  change.newIndex >= 0 ? change.newIndex : working.length;
                working.splice(index, 0, payload);
              } else if (change.type === "modified") {
                const oldIndex =
                  change.oldIndex >= 0
                    ? change.oldIndex
                    : working.findIndex((p) => p.id === payload.id);
                if (oldIndex >= 0) {
                  working.splice(oldIndex, 1);
                }
                const newIndex =
                  change.newIndex >= 0 ? change.newIndex : working.length;
                working.splice(newIndex, 0, payload);
              } else if (change.type === "removed") {
                const removeIndex =
                  change.oldIndex >= 0
                    ? change.oldIndex
                    : working.findIndex((p) => p.id === payload.id);
                if (removeIndex >= 0) {
                  working.splice(removeIndex, 1);
                }
              }
            }
          }

          const signature = createPlayersSignature(working);
          const previousSignature = playersSignatureRef.current;
          const shouldUpdatePlayers = signature !== previousSignature;
          if (shouldUpdatePlayers) {
            playersRef.current = working;
            playersSignatureRef.current = signature;
          }

          unstable_batchedUpdates(() => {
            if (shouldUpdatePlayers) {
              setPlayers(working);
            }
            setLoading(false);
          });
          setMetric("participants", "lastSnapshotTs", Date.now());
          setMetric("participants", "playersCount", working.length);
        },
        (err: FirestoreError) => {
          unstable_batchedUpdates(() => {
            setError(err);
            setLoading(false);
          });
          if (isFirebaseQuotaExceeded(err)) {
            handleFirebaseQuotaError("プレイヤー購読");
            backoffUntilRef.current = Date.now() + 5 * 60 * 1000; // 5分停止
            stop();
            if (backoffTimer) {
              try {
                clearTimeout(backoffTimer);
              } catch {}
              backoffTimer = null;
            }
            bumpMetric("participants", "quotaExceeded");
            const resume = () => {
              if (
                typeof document !== "undefined" &&
                document.visibilityState !== "visible"
              ) {
                if (
                  typeof document !== "undefined" &&
                  !visibilityCleanupRef.current
                ) {
                  const handler = () => {
                    if (document.visibilityState === "visible") {
                      detachVisibilityListener();
                      resume();
                    }
                  };
                  document.addEventListener("visibilitychange", handler);
                  visibilityCleanupRef.current = () => {
                    document.removeEventListener("visibilitychange", handler);
                  };
                  bumpMetric("participants", "visibilityAwait");
                }
                return;
              }
              detachVisibilityListener();
              const remain = backoffUntilRef.current - Date.now();
              if (remain > 0) {
                backoffTimer = setTimeout(resume, Math.min(remain, 30_000));
              } else {
                maybeStart();
              }
            };
            bumpMetric("participants", "resumeScheduled");
            resume();
          }
        }
      );
    };

    const startWithVisibilityGate = () => {
      detachStartVisibility();
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        const handler = () => {
          if (document.visibilityState === "visible") {
            document.removeEventListener("visibilitychange", handler);
            startVisibilityCleanup = null;
            void (async () => {
              try {
                const snap = await getDocs(
                  query(
                    collection(db!, "rooms", roomId, "players").withConverter(
                      playerConverter
                    ),
                    orderBy("uid", "asc")
                  )
                );
                applyPlayersSnapshot(snap.docs as unknown as Array<{ data: () => PlayerDoc; id: string }>);
              } catch {}
              maybeStart();
            })();
          }
        };
        document.addEventListener("visibilitychange", handler);
        startVisibilityCleanup = () => document.removeEventListener("visibilitychange", handler);
        return;
      }

      void (async () => {
        try {
          const snap = await getDocs(
            query(
              collection(db!, "rooms", roomId, "players").withConverter(
                playerConverter
              ),
              orderBy("uid", "asc")
            )
          );
          applyPlayersSnapshot(snap.docs as unknown as Array<{ data: () => PlayerDoc; id: string }>);
        } catch {}
        maybeStart();
      })();
    };

    const idleDelayMs = process.env.NEXT_PUBLIC_PERF_WARMUP === "1" ? 60 : 28;
    cancelIdleStart = scheduleIdleTask(
      () => {
        try {
          startWithVisibilityGate();
        } catch {}
      },
      { delayMs: idleDelayMs, timeoutMs: 180 }
    );

    return cleanup;
  }, [roomId]);

  const presenceHydratedRef = useRef(false);
  const presenceHydrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // RTDB: presence 購読
  useEffect(() => {
    presenceHydratedRef.current = false;
    onlineUidsSignatureRef.current = null;
    if (presenceHydrationTimerRef.current) {
      clearTimeout(presenceHydrationTimerRef.current);
      presenceHydrationTimerRef.current = null;
    }
    let unsubscribe: (() => void) | null = null;
    const cleanup = () => {
      if (presenceHydrationTimerRef.current) {
        clearTimeout(presenceHydrationTimerRef.current);
        presenceHydrationTimerRef.current = null;
      }
      onlineUidsSignatureRef.current = null;
      setPresenceReady(false);
      setPresenceDegraded(!presenceSupported());
      setOnlineUids(undefined);
      unsubscribe?.();
    };
    const presenceAvailable = presenceSupported();
    if (!roomId || !presenceAvailable) {
      setPresenceReady(false);
      setPresenceDegraded(!presenceAvailable);
      setOnlineUids(undefined);
      setLoading(false);
      return cleanup;
    }
    const markReady = (uids: string[]) => {
      const signature = [...uids].sort().join(",");
      if (presenceHydratedRef.current && onlineUidsSignatureRef.current === signature) {
        return;
      }
      onlineUidsSignatureRef.current = signature;
      presenceHydratedRef.current = true;
      setOnlineUids(uids);
      setPresenceReady(true);
      setMetric(
        "participants",
        "onlineCount",
        Array.isArray(uids) ? uids.length : 0
      );
    };
    let cancelIdleSubscribe: (() => void) | null = null;
    cancelIdleSubscribe = scheduleIdleTask(
      () => {
        unsubscribe = subscribePresence(roomId, (uids) => {
          logDebug("presence", "update", { roomId, uids });
          if (!presenceHydratedRef.current && uids.length === 0) {
            if (!presenceHydrationTimerRef.current) {
              presenceHydrationTimerRef.current = setTimeout(() => {
                presenceHydrationTimerRef.current = null;
                markReady([]);
              }, PRESENCE_HEARTBEAT_MS);
            }
            return;
          }
          if (presenceHydrationTimerRef.current) {
            clearTimeout(presenceHydrationTimerRef.current);
            presenceHydrationTimerRef.current = null;
          }
          markReady(uids);
        });
      },
      { delayMs: 36, timeoutMs: 200 }
    );

    return () => {
      cancelIdleSubscribe?.();
      cleanup();
    };
  }, [roomId]);

  // 自分の presence アタッチ/デタッチ
  const clearAttachRetryTimer = () => {
    if (attachRetryTimerRef.current) {
      try {
        clearTimeout(attachRetryTimerRef.current);
      } catch {}
      attachRetryTimerRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearAttachRetryTimer();
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    const cleanup = () => {
      cancelled = true;
      reattachTriggerRef.current = null;
    };

    if (!presenceSupported()) {
      clearAttachRetryTimer();
      reattachTriggerRef.current = null;
      if (detachRef.current) {
        try {
          const maybePromise = detachRef.current();
          if (isPromiseLike(maybePromise)) {
            maybePromise.catch(() => void 0);
          }
        } catch {}
        detachRef.current = null;
      }
      activePresenceRef.current = { roomId: null, uid: null };
      return cleanup;
    }

    reattachTriggerRef.current = null;

    const handleDetachIfNeeded = async () => {
      const prev = activePresenceRef.current;
      const roomChanged = prev.roomId !== (roomId ?? null);
      const uidChanged = prev.uid !== (uid ?? null);

      if (detachRef.current && (roomChanged || uidChanged || !roomId || !uid)) {
        try {
          await detachRef.current();
        } catch {}
        if (!cancelled) {
          detachRef.current = null;
        }
      }

      if (!roomId || !uid) {
        if (!cancelled) {
          activePresenceRef.current = { roomId: roomId ?? null, uid: uid ?? null };
        }
      }
    };

    const attachDelays = [0, ...PRESENCE_HEARTBEAT_RETRY_DELAYS_MS];

    const tryAttach = async (attempt = 0) => {
      if (cancelled) return;
      if (!roomId || !uid) return;
      if (detachRef.current) {
        activePresenceRef.current = { roomId, uid };
        return;
      }

      try {
        const detach = await attachPresence(roomId, uid);
        if (cancelled) {
          try {
            await detach();
          } catch {}
          return;
        }
        clearAttachRetryTimer();
        detachRef.current = detach;
        activePresenceRef.current = { roomId, uid };
      } catch {
        const nextAttempt = attempt + 1;
        const delay =
          attachDelays[
            Math.min(nextAttempt, attachDelays.length - 1)
          ];
        clearAttachRetryTimer();
        attachRetryTimerRef.current = setTimeout(
          () => {
            tryAttach(nextAttempt);
          },
          delay
        );
      }
    };

    reattachTriggerRef.current = () => {
      if (cancelled) return;
      clearAttachRetryTimer();
      void tryAttach(0);
    };

    handleDetachIfNeeded().finally(() => {
      if (!cancelled && roomId && uid) {
        clearAttachRetryTimer();
        tryAttach(0);
      }
    });

    return cleanup;
  }, [roomId, uid]);

  useEffect(() => {
    let handle: number | null = null;
    const clearExistingTimer = () => {
      if (presenceStallTimerRef.current !== null) {
        window.clearTimeout(presenceStallTimerRef.current);
        presenceStallTimerRef.current = null;
      }
    };
    const cleanup = () => {
      if (handle !== null && presenceStallTimerRef.current === handle) {
        window.clearTimeout(handle);
        presenceStallTimerRef.current = null;
      }
    };
    if (!presenceSupported()) {
      clearExistingTimer();
      setPresenceDegraded(false);
      return cleanup;
    }
    if (!roomId) {
      setPresenceDegraded(false);
      clearExistingTimer();
      return cleanup;
    }
    if (presenceReady) {
      setPresenceDegraded(false);
      clearExistingTimer();
      return cleanup;
    }
    if (presenceStallTimerRef.current !== null) {
      return cleanup;
    }
    handle = window.setTimeout(() => {
      presenceStallTimerRef.current = null;
      setPresenceDegraded(true);
    }, PRESENCE_HEARTBEAT_MS * 2);
    presenceStallTimerRef.current = handle;
    return cleanup;
  }, [presenceReady, roomId]);

  useEffect(() => {
    if (lastPresenceDegradedRef.current === presenceDegraded) return;
    if (presenceDegraded) {
      reportOpsEvent({
        name: "presence.degraded",
        metric: "ops.presence.degraded",
        level: "warning",
        tags: { state: "degraded" },
        extra: { roomId },
      });
    } else if (lastPresenceDegradedRef.current !== null) {
      reportOpsEvent({
        name: "presence.recovered",
        metric: "ops.presence.recovered",
        level: "info",
        tags: { state: "ok" },
        extra: { roomId },
      });
    }
    lastPresenceDegradedRef.current = presenceDegraded;
  }, [presenceDegraded, roomId]);

  // アンマウント時のデタッチ
  useEffect(() => {
    return () => {
      try {
        const result = detachRef.current?.();
        if (isPromiseLike(result)) {
          result.catch(() => void 0);
        }
      } catch {}
    };
  }, []);

  // ルーム変更/アンマウント時に presence グレースキャッシュを掃除
  useEffect(() => {
    return () => {
      if (typeof window === "undefined" || !roomId) return;
      try {
        if (window.__missingSince) {
          delete window.__missingSince[roomId];
        }
      } catch {}
    };
  }, [roomId]);

  useEffect(() => {
    if (!presenceReady || !Array.isArray(onlineUids)) {
      setStableOnlineUids(undefined);
      stableOnlineUidsRef.current = undefined;
      return;
    }

    const { stable, missingSince } = deriveStableOnlineUids({
      onlineUids,
      previousStable: stableOnlineUidsRef.current ?? onlineUids,
      missingSince: readMissingSinceStore(roomId),
      now: Date.now(),
      graceMs: PRESENCE_DISAPPEAR_GRACE_MS,
    });

    setStableOnlineUids(stable);
    stableOnlineUidsRef.current = stable;
    if (roomId) {
      writeMissingSinceStore(roomId, missingSince);
    }
  }, [presenceReady, onlineUids, roomId]);

  const effectiveOnlineUids = useMemo(() => {
    if (presenceReady) return onlineUids;
    if (presenceDegraded && Array.isArray(stableOnlineUids)) {
      return stableOnlineUids;
    }
    return onlineUids;
  }, [presenceReady, presenceDegraded, onlineUids, stableOnlineUids]);

  const participants = useMemo(() => {
    if (
      !Array.isArray(effectiveOnlineUids) ||
      (!presenceReady && !presenceDegraded)
    ) {
      return players;
    }
    if (effectiveOnlineUids.length === 0) {
      return [];
    }
    const set = new Set(effectiveOnlineUids);
    return players.filter((p) => set.has(p.id));
  }, [effectiveOnlineUids, players, presenceReady, presenceDegraded]);

  useEffect(() => {
    setMetric("participants", "activeCount", participants.length);
  }, [participants.length]);

  useEffect(() => {
    setMetric("participants", "presenceReady", presenceReady ? 1 : 0);
  }, [presenceReady]);

  const prevOnlineUidsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!presenceReady || !roomId) return;
    if (!Array.isArray(onlineUids)) return;
    const prev = prevOnlineUidsRef.current;
    const joined = onlineUids.filter((onlineUid) => !prev.includes(onlineUid));
    const left = prev.filter((previousUid) => !onlineUids.includes(previousUid));
    if (joined.length || left.length) {
      traceAction("presence.change", {
        roomId,
        joined,
        left,
        onlineCount: onlineUids.length,
      });
    }
    prevOnlineUidsRef.current = [...onlineUids];
  }, [presenceReady, roomId, onlineUids]);

  const detach = async () => {
    const current = detachRef.current;
    detachRef.current = null;
    activePresenceRef.current = { roomId: null, uid: null };
    if (!current) return;
    try {
      const maybeResult = current();
      if (isPromiseLike(maybeResult)) {
        await maybeResult.catch(() => void 0);
      }
    } catch {}
  };

  const reattachNow = async () => {
    await detach();
    const trigger = reattachTriggerRef.current;
    if (trigger) {
      try {
        trigger();
      } catch {}
    }
  };

  return {
    players,
    onlineUids: effectiveOnlineUids,
    stableOnlineUids,
    presenceReady,
    presenceDegraded,
    participants,
    detach,
    reattachNow,
    loading,
    error,
  };
}
