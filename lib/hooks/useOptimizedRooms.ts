import { db } from "@/lib/firebase/client";
import { roomConverter } from "@/lib/firebase/converters";
import { toMillis } from "@/lib/time";
import type { RoomDoc } from "@/lib/types";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { logDebug, logError } from "@/lib/utils/log";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";
import useSWR from "swr";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const ROOMS_PER_PAGE = 6;
const PREFETCH_PAGE_PAD = 1;
const MAX_RECENT_FETCH = 48;
const DEFAULT_RECENT_WINDOW_MS = 3 * 60 * 1000;
const ENV_RECENT_WINDOW_MS = Number(
  (process.env.NEXT_PUBLIC_LOBBY_RECENT_WINDOW_MS || "").toString()
);
const RECENT_WINDOW_MS =
  Number.isFinite(ENV_RECENT_WINDOW_MS) && ENV_RECENT_WINDOW_MS > 0
    ? ENV_RECENT_WINDOW_MS
    : DEFAULT_RECENT_WINDOW_MS;
const MIN_RECENT_WINDOW_MS = 60 * 1000;
const MAX_RECENT_WINDOW_MS = 15 * 60 * 1000;
const MIN_FETCH_COOLDOWN_MS = 30 * 1000;
const MAX_FETCH_COOLDOWN_MS = 5 * 60 * 1000;
const DEFAULT_FETCH_COOLDOWN_MS = 120 * 1000;

function recordRoomsMetric(
  name: string,
  durationMs: number,
  extra?: Record<string, unknown>
) {
  if (typeof window === "undefined") return;
  const w = window as typeof window & {
    __ITO_LOBBY_METRICS__?: Array<{
      name: string;
      duration: number;
      ts: number;
      extra?: Record<string, unknown>;
    }>;
  };
  if (!Array.isArray(w.__ITO_LOBBY_METRICS__)) {
    w.__ITO_LOBBY_METRICS__ = [];
  }
  w.__ITO_LOBBY_METRICS__!.push({
    name,
    duration: durationMs,
    ts: Date.now(),
    extra,
  });
  if (w.__ITO_LOBBY_METRICS__!.length > 200) {
    w.__ITO_LOBBY_METRICS__!.splice(0, w.__ITO_LOBBY_METRICS__!.length - 200);
  }
}

type LobbyRoom = RoomDoc & { id: string };

type UseOptimizedRoomsOptions = {
  enabled: boolean;
  page?: number;
  searchQuery?: string;
};

function createRoomsSignature(rooms: LobbyRoom[]): string {
  if (!rooms || rooms.length === 0) return "[]";
  return rooms
    .map((room) => {
      const lastActive = toMillis(room.lastActiveAt) || "";
      const expiresAt = toMillis(room.expiresAt) || "";
      return [room.id, room.status, room.hostId, lastActive, expiresAt].join(
        ":"
      );
    })
    .join("|");
}

/**
 * 🔧 Firebase読み取り最適化版 - useRooms
 * onSnapshotの常時監視を削減し、アクティブルームのみ取得
 */
export function useOptimizedRooms({
  enabled,
  page = 0,
  searchQuery,
}: UseOptimizedRoomsOptions) {
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [recentWindowMs, setRecentWindowMs] = useState(RECENT_WINDOW_MS);
  const lastFetchRef = useRef(0);
  const roomsRef = useRef<LobbyRoom[]>([]);
  const roomsSignatureRef = useRef<string>(createRoomsSignature([]));
  const fetchControlRef = useRef({
    cooldownMs: DEFAULT_FETCH_COOLDOWN_MS,
    retryCount: 0,
    inFlight: false,
    lastDurationMs: 0,
  });
  const pageIndex = useMemo(
    () => (Number.isFinite(page) && page > 0 ? Math.floor(page) : 0),
    [page]
  );
  const normalizedQuery = useMemo(
    () => (searchQuery ?? "").trim().toLowerCase(),
    [searchQuery]
  );
  const DEBUG_FETCH =
    typeof process !== "undefined" &&
    ((process.env.NEXT_PUBLIC_LOBBY_FETCH_DEBUG || "")
      .toString()
      .toLowerCase() === "true" ||
      (process.env.NEXT_PUBLIC_LOBBY_FETCH_DEBUG || "").toString().trim() ===
        "1");

  const setLoadingIfNeeded = useCallback((next: boolean) => {
    setLoading((prev) => (prev === next ? prev : next));
  }, []);

  // fetchActiveRooms を useEffect 外で定義して refresh で使えるように
  const fetchActiveRooms = useCallback(
    async (options?: { force?: boolean }): Promise<LobbyRoom[]> => {
      if (!enabled || !db) return roomsRef.current;

      const control = fetchControlRef.current;
      const force = options?.force ?? false;
      const now = Date.now();
      if (control.inFlight) {
        if (DEBUG_FETCH) {
          logDebug("useOptimizedRooms", "fetch-skipped-inflight", {
            force,
          });
        }
        return roomsRef.current;
      }
      if (!force) {
        if (now - lastFetchRef.current < control.cooldownMs) {
          if (DEBUG_FETCH) {
            logDebug("useOptimizedRooms", "fetch-skipped-cooldown", {
              remainingMs: control.cooldownMs - (now - lastFetchRef.current),
            });
          }
          return roomsRef.current;
        }
      }

      control.inFlight = true;
      const perf =
        typeof window !== "undefined" &&
        typeof window.performance !== "undefined"
          ? window.performance
          : null;
      perf?.mark("rooms_fetch_start");
      setLoadingIfNeeded(true);
      setError(null);

      const fetchStart = now;

      try {
        const roomsCol = collection(db!, "rooms").withConverter(roomConverter);

        const targetPageCount = Math.max(pageIndex + 1 + PREFETCH_PAGE_PAD, 1);
        const additionalPagesForSearch = normalizedQuery ? 4 : 0;
        const maxPageFetch = Math.min(
          targetPageCount + additionalPagesForSearch,
          Math.ceil(MAX_RECENT_FETCH / ROOMS_PER_PAGE)
        );

        const recentCutoff = new Date(Date.now() - recentWindowMs);
        const recentConstraints = [
          where("lastActiveAt", ">=", Timestamp.fromDate(recentCutoff)),
          orderBy("lastActiveAt", "desc"),
        ] as const;

        const fetchPageBatch = async () => {
          const collected: QueryDocumentSnapshot<DocumentData>[] = [];
          let cursor: QueryDocumentSnapshot<DocumentData> | null = null;

          for (let page = 0; page < maxPageFetch; page += 1) {
            let snap: QuerySnapshot<DocumentData>;
            if (cursor) {
              snap = await getDocs(
                query(
                  roomsCol,
                  ...recentConstraints,
                  startAfter(cursor),
                  limit(ROOMS_PER_PAGE)
                )
              );
            } else {
              snap = await getDocs(
                query(roomsCol, ...recentConstraints, limit(ROOMS_PER_PAGE))
              );
            }
            if (snap.empty) break;

            collected.push(...snap.docs);
            cursor = snap.docs[snap.docs.length - 1];

            if (snap.docs.length < ROOMS_PER_PAGE) {
              break;
            }
          }

          return collected;
        };

        const recentDocs = await fetchPageBatch();
        const recentRooms = recentDocs.map((d) => d.data() as LobbyRoom);

        const INPROGRESS_LIMIT = Number(
          (process.env.NEXT_PUBLIC_LOBBY_INPROGRESS_LIMIT || "").toString()
        );
        const inprogLimit =
          Number.isFinite(INPROGRESS_LIMIT) && INPROGRESS_LIMIT > 0
            ? INPROGRESS_LIMIT
            : 6;
        // 進行中（clue/reveal）は時間に関わらず上位N件のみ取得
        // 🔧 複合インデックス問題回避: orderByを除去してクライアント側ソート
        const qInprog = query(
          roomsCol,
          where("status", "in", ["clue", "reveal"] as const),
          limit(Math.max(inprogLimit, ROOMS_PER_PAGE))
        );

        const nowMs = Date.now();
        const filterValid = (room: LobbyRoom) => {
          const expMs = toMillis(room.expiresAt);
          if (expMs && expMs <= nowMs) return false;
          return true;
        };
        const snapInprog = await getDocs(qInprog);
        const inprogRooms = snapInprog.docs
          .map((d) => d.data() as LobbyRoom)
          .filter(filterValid)
          .sort((a, b) => toMillis(b.lastActiveAt) - toMillis(a.lastActiveAt));

        // 結合（重複排除: 同じidがあればinprog優先）
        const combinedMap = new Map<string, LobbyRoom>();
        for (const room of recentRooms) combinedMap.set(room.id, room);
        for (const room of inprogRooms) combinedMap.set(room.id, room);
        const combinedRooms = Array.from(combinedMap.values());
        const nextSignature = createRoomsSignature(combinedRooms);
        if (nextSignature !== roomsSignatureRef.current) {
          roomsSignatureRef.current = nextSignature;
          setRooms(combinedRooms);
        }
        roomsRef.current = combinedRooms;

        const totalCount = combinedRooms.length;
        if (!normalizedQuery) {
          let targetWindow = recentWindowMs;
          if (totalCount < ROOMS_PER_PAGE / 2) {
            targetWindow = Math.min(
              MAX_RECENT_WINDOW_MS,
              Math.round(recentWindowMs * 1.5)
            );
          } else if (totalCount > MAX_RECENT_FETCH * 0.8) {
            targetWindow = Math.max(
              MIN_RECENT_WINDOW_MS,
              Math.round(recentWindowMs * 0.75)
            );
          }
          if (targetWindow !== recentWindowMs) {
            setRecentWindowMs(targetWindow);
          }
        }

        control.retryCount = 0;
        const duration = Date.now() - fetchStart;
        control.lastDurationMs = duration;
        const nextCooldown = Math.min(
          MAX_FETCH_COOLDOWN_MS,
          Math.max(MIN_FETCH_COOLDOWN_MS, duration * 10)
        );
        control.cooldownMs = normalizedQuery
          ? Math.max(MIN_FETCH_COOLDOWN_MS, nextCooldown / 2)
          : nextCooldown;
        lastFetchRef.current = Date.now();
        if (DEBUG_FETCH) {
          logDebug("useOptimizedRooms", "fetch-success", {
            duration,
            nextCooldown: control.cooldownMs,
            recentWindowMs,
            totalCount,
          });
        }
      } catch (err) {
        control.retryCount += 1;
        control.cooldownMs = Math.min(
          MAX_FETCH_COOLDOWN_MS,
          control.cooldownMs * 2
        );
        if (isFirebaseQuotaExceeded(err)) {
          handleFirebaseQuotaError("ルーム一覧取得");
        } else {
          logError("useOptimizedRooms", "fetch-failed", err);
        }
        const normalizedError =
          err instanceof Error ? err : err ? new Error(String(err)) : null;
        setError(normalizedError);
        if (roomsSignatureRef.current !== "[]") {
          roomsSignatureRef.current = "[]";
          setRooms([]); // フォールバック
        }
        roomsRef.current = [];
      } finally {
        control.inFlight = false;
        setLoadingIfNeeded(false);
        try {
          perf?.measure("rooms_fetch", "rooms_fetch_start");
          const entry = perf?.getEntriesByName("rooms_fetch").pop();
          if (entry) {
            recordRoomsMetric("rooms_fetch", entry.duration, {
              cooldownMs: fetchControlRef.current.cooldownMs,
              windowMs: recentWindowMs,
            });
          }
        } catch {}
        perf?.clearMarks("rooms_fetch_start");
        perf?.clearMeasures?.("rooms_fetch");
      }
      return roomsRef.current;
    },
    [
      enabled,
      setLoadingIfNeeded,
      pageIndex,
      normalizedQuery,
      recentWindowMs,
      setRecentWindowMs,
      DEBUG_FETCH,
    ]
  );

  const swrKey = enabled
    ? ["optimizedRooms", pageIndex, normalizedQuery, recentWindowMs]
    : null;
  const { isValidating, mutate } = useSWR(
    swrKey,
    () => fetchActiveRooms({ force: true }),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 4000,
      focusThrottleInterval: 1200,
      keepPreviousData: true,
    }
  );

  useEffect(() => {
    if (!enabled) {
      roomsSignatureRef.current = "[]";
      roomsRef.current = [];
      setRooms([]);
      setLoadingIfNeeded(false);
      return;
    }
    setLoadingIfNeeded(true);
    void mutate();
  }, [enabled, mutate, setLoadingIfNeeded]);

  const refresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  return {
    rooms,
    loading: loading || isValidating,
    error,
    refresh,
    pageSize: ROOMS_PER_PAGE,
  };
}
