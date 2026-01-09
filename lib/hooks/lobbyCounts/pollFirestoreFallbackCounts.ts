import { ACTIVE_WINDOW_MS } from "@/lib/time";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { logWarn } from "@/lib/utils/log";
import {
  Timestamp,
  collection,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";
import type { Dispatch, SetStateAction } from "react";

import { applyCountUpdates } from "@/lib/hooks/lobbyCounts/applyCountUpdates";
import { createFreezeTracker } from "@/lib/hooks/lobbyCounts/freezeTracker";
import { readAggregateCount } from "@/lib/hooks/lobbyCounts/readAggregateCount";

export function pollFirestoreFallbackCounts(params: {
  normalizedRoomIds: readonly string[];
  setCounts: Dispatch<SetStateAction<Record<string, number>>>;
  db: unknown;
}): () => void {
  const { normalizedRoomIds, setCounts, db } = params;

  let cancelled = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  // 0人からの反跳ね（lastSeenで近似カウントするため起こりやすい）を防ぐ
  // フォールバック時は ACTIVE_WINDOW_MS 中は 0 を維持する方が UX 的に合理的
  const zeroFreeze: Record<string, number> = {};
  const freezeTracker = createFreezeTracker("fallback");
  const envFallbackFreeze = Number(
    (process.env.NEXT_PUBLIC_LOBBY_ZERO_FREEZE_MS || "").toString()
  );
  const fallbackZeroBase =
    Number.isFinite(envFallbackFreeze) && envFallbackFreeze > 0
      ? envFallbackFreeze
      : ACTIVE_WINDOW_MS + 10_000;
  const FALLBACK_ZERO_FREEZE_MS = Math.min(fallbackZeroBase, 30_000);

  // デバッグ補助: 本来は presence を使う想定なので、フォールバック使用時に一度だけ警告
  if (typeof window !== "undefined") {
    logWarn("useLobbyCounts", "firestore-fallback", {});
  }

  const fetchCounts = async () => {
    if (cancelled) return;

    try {
      const entries = await Promise.all(
        normalizedRoomIds.map(async (id) => {
          try {
            const coll = collection(db as never, "rooms", id, "players");
            // lastSeen が直近 ACTIVE_WINDOW_MS 以内のプレイヤーをカウント
            const since = Timestamp.fromMillis(Date.now() - ACTIVE_WINDOW_MS);
            const q = query(coll, where("lastSeen", ">=", since));
            const snap = await getCountFromServer(q);
            const n = readAggregateCount(snap);
            return [id, n] as const;
          } catch (err) {
            if (isFirebaseQuotaExceeded(err)) {
              handleFirebaseQuotaError("ルームカウント更新");
            }
            return [id, 0] as const;
          }
        })
      );

      const now = Date.now();
      const next: Record<string, number> = {};

      for (const [id, raw] of entries) {
        const freezeUntil = zeroFreeze[id] || 0;
        if (raw === 0) {
          zeroFreeze[id] = now + FALLBACK_ZERO_FREEZE_MS;
          freezeTracker.start(id, now, zeroFreeze[id], FALLBACK_ZERO_FREEZE_MS);
          next[id] = 0;
        } else {
          if (freezeUntil > 0) {
            zeroFreeze[id] = 0;
            freezeTracker.end(id, now);
          }
          next[id] = raw;
        }
      }

      if (!cancelled) applyCountUpdates(setCounts, next);
    } catch (err) {
      if (isFirebaseQuotaExceeded(err)) {
        handleFirebaseQuotaError("ルームカウント更新");
      }
      // noop
    }
  };

  const tick = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    fetchCounts();
  };

  // 初回も可視時のみ実行し、非表示時の無駄な読取を回避
  if (typeof document === "undefined" || document.visibilityState === "visible") {
    tick();
  }
  timer = setInterval(tick, 2 * 60 * 1000);

  return () => {
    cancelled = true;
    if (timer) {
      try {
        clearInterval(timer);
      } catch {
        // ignore timer cleanup failures
      }
    }
  };
}
