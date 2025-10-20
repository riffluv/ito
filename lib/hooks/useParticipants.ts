"use client";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import { playerConverter } from "@/lib/firebase/converters";
import {
  attachPresence,
  presenceSupported,
  subscribePresence,
} from "@/lib/firebase/presence";
import {
  PRESENCE_HEARTBEAT_MS,
} from "@/lib/constants/presence";
import type { PlayerDoc } from "@/lib/types";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { logDebug } from "@/lib/utils/log";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { unstable_batchedUpdates } from "react-dom";

export type ParticipantsState = {
  players: (PlayerDoc & { id: string })[];
  onlineUids?: string[]; // presenceReady=false の間は undefined
  presenceReady: boolean;
  participants: (PlayerDoc & { id: string })[]; // players ∩ online
  detach: () => Promise<void> | void; // 明示的退出時に使用
  loading: boolean;
  error: Error | null;
};

export function useParticipants(
  roomId: string,
  uid: string | null
): ParticipantsState {
  const [players, setPlayers] = useState<(PlayerDoc & { id: string })[]>([]);
  const [onlineUids, setOnlineUids] = useState<string[] | undefined>(undefined);
  const [presenceReady, setPresenceReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const detachRef = useRef<null | (() => Promise<void> | void)>(null);
  const activePresenceRef = useRef<{ roomId: string | null; uid: string | null }>({
    roomId: null,
    uid: null,
  });

  // Firestore: players 購読（タブ非表示時は停止、429時はバックオフ）
  useEffect(() => {
    if (!firebaseEnabled) return;
    if (!roomId) return;
    setLoading(true);
    setError(null);

    const unsubRef = { current: null as null | (() => void) };
    const backoffUntilRef = { current: 0 };
    let backoffTimer: ReturnType<typeof setTimeout> | null = null;

    const visibilityCleanupRef = { current: null as null | (() => void) };

    const detachVisibilityListener = () => {
      if (typeof document === "undefined") return;
      if (visibilityCleanupRef.current) {
        visibilityCleanupRef.current();
        visibilityCleanupRef.current = null;
      }
    };

    const stop = () => {
      try {
        unsubRef.current?.();
      } catch {}
      unsubRef.current = null;
      detachVisibilityListener();
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
          const list: (PlayerDoc & { id: string })[] = [];
          snap.forEach((d) => list.push(d.data() as any));
          unstable_batchedUpdates(() => {
            setPlayers(list);
            setLoading(false);
          });
          setMetric("participants", "lastSnapshotTs", Date.now());
          setMetric("participants", "playersCount", list.length);
        },
        (err) => {
          unstable_batchedUpdates(() => {
            setError(err as any);
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

    // 常時購読（非アクティブでも即時同期）
    maybeStart();

    return () => {
      if (backoffTimer) {
        try {
          clearTimeout(backoffTimer);
        } catch {}
      }
      stop();
      detachVisibilityListener();
    };
  }, [roomId]);

  const presenceHydratedRef = useRef(false);
  const presenceHydrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // RTDB: presence 購読
  useEffect(() => {
    presenceHydratedRef.current = false;
    if (presenceHydrationTimerRef.current) {
      clearTimeout(presenceHydrationTimerRef.current);
      presenceHydrationTimerRef.current = null;
    }
    if (!roomId || !presenceSupported()) {
      setPresenceReady(false);
      setOnlineUids(undefined);
      return;
    }
    const markReady = (uids: string[]) => {
      presenceHydratedRef.current = true;
      setOnlineUids(uids);
      setPresenceReady(true);
      setMetric(
        "participants",
        "onlineCount",
        Array.isArray(uids) ? uids.length : 0
      );
    };
    const off = subscribePresence(roomId, (uids) => {
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
    return () => {
      if (presenceHydrationTimerRef.current) {
        clearTimeout(presenceHydrationTimerRef.current);
        presenceHydrationTimerRef.current = null;
      }
      setPresenceReady(false);
      setOnlineUids(undefined);
      off();
    };
  }, [roomId]);

  // 自分の presence アタッチ/デタッチ
  useEffect(() => {
    if (!presenceSupported()) {
      if (detachRef.current) {
        try {
          const maybePromise = detachRef.current();
          if (maybePromise && typeof (maybePromise as Promise<void>).then === "function") {
            (maybePromise as Promise<void>).catch(() => void 0);
          }
        } catch {}
        detachRef.current = null;
      }
      activePresenceRef.current = { roomId: null, uid: null };
      return;
    }

    let cancelled = false;
    void (async () => {
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
        return;
      }

      if (!detachRef.current) {
        try {
          const detach = await attachPresence(roomId, uid);
          if (cancelled) {
            try {
              await detach();
            } catch {}
            return;
          }
          detachRef.current = detach;
          activePresenceRef.current = { roomId, uid };
        } catch {}
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomId, uid]);

  // アンマウント時のデタッチ
  useEffect(() => {
    return () => {
      try {
        const r = detachRef.current?.();
        if (r && typeof (r as any).then === "function")
          (r as Promise<void>).catch(() => {});
      } catch {}
    };
  }, []);

  const participants = useMemo(() => {
    if (!presenceReady || !Array.isArray(onlineUids)) {
      return players;
    }
    if (onlineUids.length === 0) {
      return [];
    }
    const set = new Set(onlineUids);
    return players.filter((p) => set.has(p.id));
  }, [
    players,
    presenceReady,
    Array.isArray(onlineUids) ? onlineUids.join(",") : "_",
  ]);

  useEffect(() => {
    setMetric("participants", "activeCount", participants.length);
  }, [participants.length]);

  useEffect(() => {
    setMetric("participants", "presenceReady", presenceReady ? 1 : 0);
  }, [presenceReady]);

  const detach = async () => {
    try {
      const r = detachRef.current?.();
      if (r && typeof (r as any).then === "function")
        await (r as Promise<void>);
    } catch {}
  };

  return {
    players,
    onlineUids,
    presenceReady,
    participants,
    detach,
    loading,
    error,
  };
}
