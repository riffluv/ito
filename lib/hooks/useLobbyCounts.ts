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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  // 緊急時に Firestore フォールバックを完全停止するフラグ（.env から）
  const DISABLE_FS_FALLBACK =
    typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_DISABLE_FS_FALLBACK?.toString() === "1" ||
      process.env.NEXT_PUBLIC_DISABLE_FS_FALLBACK?.toLowerCase() === "true");

  // roomIds キー以外の値をクリーンに保つ
  const roomKey = useMemo(
    () => Array.from(new Set(roomIds)).sort().join(","),
    [roomIds]
  );
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
      // ロビー表示はゴースト抑制のため、presenceの鮮度しきい値をさらに短めに（既定8s）
      const ENV_STALE = Number(
        (process.env.NEXT_PUBLIC_LOBBY_STALE_MS || "").toString()
      );
      const LOBBY_STALE_MS = Math.min(
        PRESENCE_STALE_MS,
        Number.isFinite(ENV_STALE) && ENV_STALE > 0 ? ENV_STALE : 8_000
      );
      // 0人からの反跳ね（古いconnが遅れて現れる）を防ぐためのクールダウン
      const zeroFreeze: Record<string, number> = {};
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
            // より厳格な判定：最新の有効なタイムスタンプのみ
            let latestValidTs = 0;
            for (const c of Object.values(conns) as any[]) {
              const ts = typeof c?.ts === "number" ? c.ts : 0;
              if (ts <= 0) continue; // 無効なタイムスタンプ
              if (ts - now > MAX_CLOCK_SKEW_MS) continue; // 未来すぎる
              if (now - ts > LOBBY_STALE_MS) continue; // 古すぎる（ロビーは短め）
              latestValidTs = Math.max(latestValidTs, ts);
            }
            const isOnline = latestValidTs > 0;
            if (isOnline) n += 1;
          }
          // 0→N と跳ね返る現象の緩和：0になった直後は一定時間0のまま据え置く
          const freezeUntil = zeroFreeze[id] || 0;
          if (n === 0) {
            const ENV_ZERO_FREEZE = Number(
              (process.env.NEXT_PUBLIC_LOBBY_ZERO_FREEZE_MS || "").toString()
            );
            const ZERO_FREEZE_MS =
              Number.isFinite(ENV_ZERO_FREEZE) && ENV_ZERO_FREEZE > 0
                ? ENV_ZERO_FREEZE
                : 20_000;
            zeroFreeze[id] = now + ZERO_FREEZE_MS; // 0表示を据え置き
            setCounts((prev) => ({ ...prev, [id]: 0 }));
          } else if (now < freezeUntil) {
            // クールダウン中は0のまま
            setCounts((prev) => ({ ...prev, [id]: 0 }));
          } else {
            setCounts((prev) => ({ ...prev, [id]: n }));
          }
        };
        const onErr = () => setCounts((prev) => ({ ...prev, [id]: 0 }));
        onValue(roomRef, handler, onErr as any);
        return () => off(roomRef, "value", handler);
      });
      return () => offs.forEach((fn) => fn());
    }

    // フォールバック: Firestore 集計クエリで players 件数を軽量取得
    // 常時 onSnapshot は使用せず、一定間隔でポーリング
    if (DISABLE_FS_FALLBACK) {
      // フラグ有効時は一切の読み取りを行わず、0固定にする
      setCounts((prev) => {
        const next: Record<string, number> = {};
        for (const id of roomIds) next[id] = 0;
        return next;
      });
      return;
    }
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
    const tick = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      )
        return;
      fetchCounts();
    };
    // 初回も可視時のみ実行し、非表示時の無駄な読取を回避
    if (
      typeof document === "undefined" ||
      document.visibilityState === "visible"
    ) {
      tick();
    }
    timer = setInterval(tick, 2 * 60 * 1000);

    return () => {
      cancelled = true;
      if (timer)
        try {
          clearInterval(timer);
        } catch {}
    };
  }, [firebaseEnabled, enabled, roomKey, refreshTrigger]);

  // refresh関数：手動でpresenceデータを再取得
  const refresh = () => setRefreshTrigger((prev) => prev + 1);

  return { counts, refresh };
}
