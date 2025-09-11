"use client";
import { db, firebaseEnabled } from "@/lib/firebase/client";
import {
  attachPresence,
  presenceSupported,
  subscribePresence,
} from "@/lib/firebase/presence";
import { playerConverter } from "@/lib/firebase/converters";
import type { PlayerDoc } from "@/lib/types";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";

export type ParticipantsState = {
  players: (PlayerDoc & { id: string })[];
  onlineUids?: string[]; // undefined の場合はpresence未対応 → lastSeen等のフォールバックを検討
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

    const stop = () => {
      try { unsubRef.current?.(); } catch {}
      unsubRef.current = null;
    };

    const maybeStart = () => {
      if (unsubRef.current) return;
      const now = Date.now();
      if (now < backoffUntilRef.current) return;
      unsubRef.current = onSnapshot(
        query(
          collection(db!, "rooms", roomId, "players").withConverter(playerConverter),
          orderBy("uid", "asc")
        ),
        (snap) => {
          const list: (PlayerDoc & { id: string })[] = [];
          snap.forEach((d) => list.push(d.data() as any));
          setPlayers(list);
          setLoading(false);
        },
        (err) => {
          setError(err as any);
          setLoading(false);
          if (isFirebaseQuotaExceeded(err)) {
            handleFirebaseQuotaError("プレイヤー購読");
            backoffUntilRef.current = Date.now() + 5 * 60 * 1000; // 5分停止
            stop();
            if (backoffTimer) {
              try { clearTimeout(backoffTimer); } catch {}
              backoffTimer = null;
            }
            const resume = () => {
              if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
              const remain = backoffUntilRef.current - Date.now();
              if (remain > 0) backoffTimer = setTimeout(resume, Math.min(remain, 30_000));
              else maybeStart();
            };
            resume();
          }
        }
      );
    };

    // 初回は可視時のみ購読開始（無駄な読取回避）
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      maybeStart();
    }

    const onVis = () => {
      if (document.visibilityState === "visible") maybeStart();
      else stop();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
      if (backoffTimer) {
        try { clearTimeout(backoffTimer); } catch {}
      }
      stop();
    };
  }, [roomId]);

  // RTDB: presence 購読
  useEffect(() => {
    if (!presenceSupported()) {
      setOnlineUids(undefined);
      return;
    }
    if (!roomId) return;
    const off = subscribePresence(roomId, (uids) => setOnlineUids(uids));
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
    if (!Array.isArray(onlineUids)) return players; // フォールバック: 全員表示（サイド効果なし）
    const set = new Set(onlineUids);
    return players.filter((p) => set.has(p.id));
  }, [players, Array.isArray(onlineUids) ? onlineUids.join(",") : "_"]);

  const detach = async () => {
    try {
      const r = detachRef.current?.();
      if (r && typeof (r as any).then === "function")
        await (r as Promise<void>);
    } catch {}
  };

  return { players, onlineUids, participants, detach, loading, error };
}
