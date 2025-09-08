"use client";
import { db, firebaseEnabled, rtdb } from "@/lib/firebase/client";
import {
  MAX_CLOCK_SKEW_MS,
  PRESENCE_STALE_MS,
  presenceSupported,
} from "@/lib/firebase/presence";
import { ACTIVE_WINDOW_MS } from "@/lib/time";
import { off, onValue, ref } from "firebase/database";
import {
  Timestamp,
  collection,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";

export function useLobbyCounts(roomIds: string[], enabled: boolean) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  // roomIds キー以外の値をクリーンに保つ
  const roomKey = useMemo(() => roomIds.slice().sort().join(","), [roomIds]);
  useEffect(() => {
    setCounts((prev) => {
      const next: Record<string, number> = {};
      for (const id of roomIds) next[id] = prev[id] ?? 0;
      return next;
    });
  }, [roomKey]);

  useEffect(() => {
    if (!firebaseEnabled || !enabled) {
      setCounts({});
      return;
    }
    if (roomIds.length === 0) {
      setCounts({});
      return;
    }

    // RTDB presence を部屋ごとに購読（ルール互換性のため /presence/$roomId を読む）
    if (presenceSupported()) {
      const offs = roomIds.map((id) => {
        const roomRef = ref(rtdb!, `presence/${id}`);
        const handler = (snap: any) => {
          const users = (snap.val() || {}) as Record<
            string,
            Record<string, any>
          >; // uid -> connId -> { ts }
          let n = 0;
          const now = Date.now();
          for (const uid of Object.keys(users)) {
            const conns = users[uid] || {};
            const isOnline = Object.values(conns).some((c: any) => {
              if (c?.online === true && typeof c?.ts !== "number") return true;
              const ts = typeof c?.ts === "number" ? c.ts : 0;
              if (ts <= 0) return false;
              if (ts - now > MAX_CLOCK_SKEW_MS) return false;
              return now - ts <= PRESENCE_STALE_MS;
            });
            if (isOnline) n += 1;
          }
          setCounts((prev) => ({ ...prev, [id]: n }));
        };
        const onErr = () => setCounts((prev) => ({ ...prev, [id]: 0 }));
        onValue(roomRef, handler, onErr as any);
        return () => off(roomRef, "value", handler);
      });
      return () => offs.forEach((fn) => fn());
    }

    // フォールバック: Firestore 集計クエリで players 件数を軽量取得
    // 常時 onSnapshot は使用せず、一定間隔でポーリング
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchCounts = async () => {
      if (cancelled) return;
      try {
        const entries = await Promise.all(
          roomIds.map(async (id) => {
            try {
              const coll = collection(db!, "rooms", id, "players");
              // lastSeen が直近 ACTIVE_WINDOW_MS 以内のプレイヤーをカウント
              const since = Timestamp.fromMillis(Date.now() - ACTIVE_WINDOW_MS);
              const q = query(coll, where("lastSeen", ">=", since));
              const snap = await getCountFromServer(q);
              // count は number | Long 相当だが、Web SDK は number を返す
              const n = (snap.data() as any)?.count ?? 0;
              return [id, Number(n) || 0] as const;
            } catch {
              return [id, 0] as const;
            }
          })
        );
        const next: Record<string, number> = {};
        for (const [id, n] of entries) next[id] = n;
        if (!cancelled) setCounts((prev) => ({ ...prev, ...next }));
      } catch {
        // noop
      }
    };

    // 初回 + 2分間隔で更新（ロビーの人数表示は近似で十分）
    fetchCounts();
    timer = setInterval(fetchCounts, 2 * 60 * 1000);

    return () => {
      cancelled = true;
      if (timer)
        try {
          clearInterval(timer);
        } catch {}
    };
  }, [firebaseEnabled, enabled, roomKey]);

  return counts;
}
