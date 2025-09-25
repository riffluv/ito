import { db } from "@/lib/firebase/client";
import { roomConverter } from "@/lib/firebase/converters";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
import { logError } from "@/lib/utils/log";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

// 型定義（Room docに直接hostNameが含まれる）
interface RoomWithHost {
  id: string;
  hostId: string;
  hostName?: string;
  name: string;
  status: string;
  expiresAt?: any;
  createdAt?: any;
  lastActiveAt?: any;
}


export const ROOMS_PER_PAGE = 6;
const PREFETCH_PAGE_PAD = 1;
const MAX_RECENT_FETCH = 48;

type UseOptimizedRoomsOptions = {
  enabled: boolean;
  page?: number;
  searchQuery?: string;
};

function createRoomsSignature(rooms: RoomWithHost[]): string {
  if (!rooms || rooms.length === 0) return '[]';
  return rooms
    .map((room) => {
      const lastActive = typeof (room.lastActiveAt as any)?.toMillis === 'function'
        ? (room.lastActiveAt as any).toMillis()
        : room.lastActiveAt ?? '';
      const expiresAt = typeof (room.expiresAt as any)?.toMillis === 'function'
        ? (room.expiresAt as any).toMillis()
        : room.expiresAt ?? '';
      return [room.id, room.status, room.hostId, lastActive, expiresAt].join(':');
    })
    .join('|');
}

/**
 * 🔧 Firebase読み取り最適化版 - useRooms
 * onSnapshotの常時監視を削減し、アクティブルームのみ取得
 */
export function useOptimizedRooms({ enabled, page = 0, searchQuery }: UseOptimizedRoomsOptions) {
  const [rooms, setRooms] = useState<RoomWithHost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchRef = useRef(0);
  const roomsSignatureRef = useRef<string>(createRoomsSignature([]));
  const pageIndex = Number.isFinite(page) && page > 0 ? Math.floor(page) : 0;
  const normalizedQuery = (searchQuery ?? "").trim().toLowerCase();


  const setLoadingIfNeeded = useCallback((next: boolean) => {
    setLoading((prev) => (prev === next ? prev : next));
  }, []);

  // fetchActiveRooms を useEffect 外で定義して refresh で使えるように
  const fetchActiveRooms = useCallback(async () => {
    if (!enabled || !db) return;

    setLoadingIfNeeded(true);
    setError((prev) => (prev ? null : prev));

    try {
      const prefetchPages = Math.max(pageIndex + 1 + PREFETCH_PAGE_PAD, 1);
      let recentLimit = Math.min(
        Math.max(ROOMS_PER_PAGE, ROOMS_PER_PAGE * prefetchPages),
        MAX_RECENT_FETCH
      );
      if (normalizedQuery) {
        recentLimit = Math.min(
          MAX_RECENT_FETCH,
          Math.max(recentLimit, ROOMS_PER_PAGE * 6)
        );
      }
      // 🚨 緊急読み取り削減: 直近3分のみに制限
      const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000);
      const roomsCol = collection(db!, "rooms").withConverter(roomConverter);
      const qRecent = query(
        roomsCol,
        where("lastActiveAt", ">=", Timestamp.fromDate(threeMinAgo)),
        orderBy("lastActiveAt", "desc"),
        limit(recentLimit)
      );
      const INPROGRESS_LIMIT = Number(
        (process.env.NEXT_PUBLIC_LOBBY_INPROGRESS_LIMIT || "").toString()
      );
      const inprogLimit = Number.isFinite(INPROGRESS_LIMIT) && INPROGRESS_LIMIT > 0 ? INPROGRESS_LIMIT : 3;
      // 進行中（clue/reveal）は時間に関わらず上位N件のみ取得
      // 🔧 複合インデックス問題回避: orderByを除去してクライアント側ソート
      const qInprog = query(
        roomsCol,
        where("status", "in", ["clue", "reveal"] as any),
        limit(Math.max(inprogLimit, ROOMS_PER_PAGE))
      );

      const [snapRecent, snapInprog] = await Promise.all([getDocs(qRecent), getDocs(qInprog)]);

      const now = Date.now();
      const filterValid = (r: any) => {
        const exp = (r as any).expiresAt;
        const expMs = typeof exp?.toMillis === "function" ? exp.toMillis() : 0;
        if (expMs && expMs <= now) return false;
        return true;
      };

      const recentRooms = snapRecent.docs.map((d) => d.data() as any).filter(filterValid);
      const inprogRooms = snapInprog.docs.map((d) => d.data() as any).filter(filterValid)
        .sort((a: any, b: any) => {
          // クライアント側でlastActiveAtソート
          const aTime = a.lastActiveAt?.toMillis?.() || 0;
          const bTime = b.lastActiveAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

      // 結合（重複排除: 同じidがあればinprog優先）
      const map = new Map<string, any>();
      for (const r of recentRooms) map.set(r.id, r);
      for (const r of inprogRooms) map.set(r.id, r);
      const combinedRooms = Array.from(map.values());
      const nextSignature = createRoomsSignature(combinedRooms);
      if (nextSignature !== roomsSignatureRef.current) {
        roomsSignatureRef.current = nextSignature;
        setRooms(combinedRooms);
      }
      lastFetchRef.current = Date.now();
    } catch (err: any) {
      // Firebase制限エラー専用処理
      if (isFirebaseQuotaExceeded(err)) {
        handleFirebaseQuotaError("ルーム一覧取得");
      } else {
        logError("useOptimizedRooms", "fetch-failed", err);
      }
      setError(err);
      if (roomsSignatureRef.current !== "[]") {
        roomsSignatureRef.current = "[]";
        setRooms([]); // フォールバック
      }
    } finally {
      setLoadingIfNeeded(false);
    }
  }, [enabled, db, setLoadingIfNeeded, pageIndex, normalizedQuery]);

  useEffect(() => {
    if (!enabled || !db) {
      roomsSignatureRef.current = "[]";
      setRooms([]);
      setLoadingIfNeeded(false);
      return;
    }

    let mounted = true;

    const wrappedFetch = async () => {
      if (!mounted) return;
      await fetchActiveRooms();
    };

    // 初回取得
    wrappedFetch();

    // 読み取り削減: タブ非表示時は停止、表示時に単発fetchのみ（ポーリングなし）
    const visibilityHandler = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastFetchRef.current < 120 * 1000) return; // 🚨 60秒 → 120秒に延長
      wrappedFetch();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    visibilityHandler();

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [enabled, db, fetchActiveRooms, setLoadingIfNeeded]);

  const refresh = useCallback(() => {
    fetchActiveRooms();
  }, [fetchActiveRooms]);

  return { rooms, loading, error, refresh, pageSize: ROOMS_PER_PAGE };
}









