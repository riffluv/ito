"use client";

import { db, firebaseEnabled, rtdb } from "@/lib/firebase/client";
import { presenceSupported } from "@/lib/firebase/presence";
import type { VerificationHealth } from "@/lib/lobby/verificationHealth";
import { pollFirestoreFallbackCounts } from "@/lib/hooks/lobbyCounts/pollFirestoreFallbackCounts";
import { subscribePresenceCounts } from "@/lib/hooks/lobbyCounts/subscribePresenceCounts";
import { logInfo } from "@/lib/utils/log";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type VerificationCacheEntry = {
  count: number;
  expiresAt: number;
};

const noopCleanup = () => {};

export type UseLobbyCountsOptions = {
  // 自分自身や特定UIDをカウントから除外（ロビー表示で「他人数」を出したい場合や、
  // 退出直後の自身ゴースト対策として有効）
  excludeUid?: string | string[];
};

function normalizeExcludeUids(excludeUid?: string | string[]): string[] {
  if (!excludeUid) return [];
  const source = Array.isArray(excludeUid) ? excludeUid : [excludeUid];
  return Array.from(
    new Set(source.filter((uid): uid is string => typeof uid === "string" && uid.length > 0))
  );
}

export function useLobbyCounts(
  roomIds: string[],
  enabled: boolean,
  options?: UseLobbyCountsOptions
) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const verificationStateRef = useRef({
    cache: new Map<string, VerificationCacheEntry>(),
    health: new Map<string, VerificationHealth>(),
  });
  const verificationLastCheckRef = useRef({
    single: {} as Record<string, number>,
    multi: {} as Record<string, number>,
  });

  const excludeUidSet = useMemo(() => {
    const normalizedExcludeUids = normalizeExcludeUids(options?.excludeUid);
    return new Set(normalizedExcludeUids);
  }, [options?.excludeUid]);

  // 緊急時に Firestore フォールバックを完全停止するフラグ（.env から）
  const disableFsFallback = useMemo(() => {
    if (typeof process === "undefined") return false;
    const raw = process.env.NEXT_PUBLIC_DISABLE_FS_FALLBACK?.toString().toLowerCase();
    return raw === "1" || raw === "true";
  }, []);

  const debugFallback = useMemo(() => {
    if (typeof process === "undefined") return false;
    const raw = (process.env.NEXT_PUBLIC_LOBBY_DEBUG_FALLBACK || "")
      .toString()
      .toLowerCase();
    if (!raw) return false;
    if (raw === "1" || raw === "true") return true;
    return (process.env.NEXT_PUBLIC_LOBBY_DEBUG_FALLBACK || "").toString().trim() === "1";
  }, []);

  const normalizedRoomIds = useMemo(
    () => Array.from(new Set(roomIds)).sort(),
    [roomIds]
  );

  useEffect(() => {
    setCounts((prev) => {
      const next: Record<string, number> = {};
      for (const id of normalizedRoomIds) {
        next[id] = prev[id] ?? 0;
      }
      return next;
    });
  }, [normalizedRoomIds]);

  useEffect(() => {
    if (!firebaseEnabled || !enabled) {
      setCounts({});
      return noopCleanup;
    }
    if (normalizedRoomIds.length === 0) {
      setCounts({});
      return noopCleanup;
    }

    // RTDB presence を部屋ごとに購読（ルール互換性のため /presence/$roomId を読む）
    if (presenceSupported()) {
      return subscribePresenceCounts({
        normalizedRoomIds,
        setCounts,
        rtdb: rtdb!,
        excludeUidSet,
        disableFsFallback,
        debugFallback,
        verificationStateRef,
        verificationLastCheckRef,
      });
    }

    // フォールバック: Firestore 集計クエリで players 件数を軽量取得
    // 常時 onSnapshot は使用せず、一定間隔でポーリング
    if (disableFsFallback) {
      if (typeof window !== "undefined") {
        logInfo("useLobbyCounts", "firestore-fallback-disabled", {
          reason: "NEXT_PUBLIC_DISABLE_FS_FALLBACK",
        });
      }
      // フラグ有効時は一切の読み取りを行わず、0固定にする
      setCounts(() => {
        const next: Record<string, number> = {};
        for (const id of normalizedRoomIds) next[id] = 0;
        return next;
      });
      return noopCleanup;
    }

    return pollFirestoreFallbackCounts({
      normalizedRoomIds,
      setCounts,
      db: db!,
    });
  }, [
    enabled,
    normalizedRoomIds,
    refreshTrigger,
    excludeUidSet,
    disableFsFallback,
    debugFallback,
  ]);

  // refresh関数：手動でpresenceデータを再取得
  const refresh = () => setRefreshTrigger((prev) => prev + 1);

  return { counts, refresh };
}
