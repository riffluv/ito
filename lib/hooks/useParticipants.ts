"use client";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import { playerConverter } from "@/lib/firebase/converters";
import {
  attachPresence,
  presenceSupported,
  subscribePresence,
} from "@/lib/firebase/presence";
import { ACTIVE_WINDOW_MS, isActive } from "@/lib/time";
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
  onlineUids?: string[]; // undefined の場合はpresence未対応 → lastSeen等のフォールバックを検討
  participants: (PlayerDoc & { id: string })[]; // players ∩ online
  detach: () => Promise<void> | void; // 明示的退出時に使用
  loading: boolean;
  error: Error | null;
};

const disableFsFallback =
  (process.env.NEXT_PUBLIC_DISABLE_FS_FALLBACK || "")
    .toString()
    .toLowerCase() === "1" ||
  (process.env.NEXT_PUBLIC_DISABLE_FS_FALLBACK || "")
    .toString()
    .toLowerCase() === "true";

export function useParticipants(
  roomId: string,
  uid: string | null
): ParticipantsState {
  const [players, setPlayers] = useState<(PlayerDoc & { id: string })[]>([]);
  const [onlineUids, setOnlineUids] = useState<string[] | undefined>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const detachRef = useRef<null | (() => Promise<void> | void)>(null);

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

  // RTDB: presence 購読
  useEffect(() => {
    if (!presenceSupported()) {
      setOnlineUids(disableFsFallback ? [] : undefined);
      return;
    }
    if (!roomId) return;
    const off = subscribePresence(roomId, (uids) => {
      logDebug("presence", "update", { roomId, uids });
      setOnlineUids(uids);
      setMetric("participants", "onlineCount", Array.isArray(uids) ? uids.length : 0);
    });
    return () => off();
  }, [roomId]);

  // 自分の presence アタッチ/デタッチ
  useEffect(() => {
    if (!presenceSupported()) return;
    let cancelled = false;
    (async () => {
      try {
        if (uid) {
          if (!detachRef.current) {
            const detach = await attachPresence(roomId, uid);
            if (!cancelled) detachRef.current = detach;
          }
        } else if (detachRef.current) {
          await detachRef.current();
          if (!cancelled) detachRef.current = null;
        }
      } catch {}
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
    // presence 未対応/利用不可時: lastSeen を用いた近似で“実活動中”のみ表示
    if (!Array.isArray(onlineUids) || onlineUids.length === 0) {
      if (disableFsFallback) {
        return players;
      }
      const now = Date.now();
      return players.filter((p) =>
        isActive((p as any).lastSeen, now, ACTIVE_WINDOW_MS)
      );
    }
    const set = new Set(onlineUids);
    return players.filter((p) => set.has(p.id));
  }, [players, Array.isArray(onlineUids) ? onlineUids.join(",") : "_"]);

  useEffect(() => {
    setMetric("participants", "activeCount", participants.length);
  }, [participants.length]);

  const detach = async () => {
    try {
      const r = detachRef.current?.();
      if (r && typeof (r as any).then === "function")
        await (r as Promise<void>);
    } catch {}
  };

  return { players, onlineUids, participants, detach, loading, error };
}
