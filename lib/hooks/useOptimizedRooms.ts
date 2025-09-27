import { db } from "@/lib/firebase/client";
import { roomConverter } from "@/lib/firebase/converters";
import { toMillis } from "@/lib/time";
import type { RoomDoc } from "@/lib/types";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { logError } from "@/lib/utils/log";
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
import { useCallback, useEffect, useRef, useState } from "react";

export const ROOMS_PER_PAGE = 6;
const PREFETCH_PAGE_PAD = 1;
const MAX_RECENT_FETCH = 48;

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
      const roomsCol = collection(db!, "rooms").withConverter(roomConverter);

      const targetPageCount = Math.max(pageIndex + 1 + PREFETCH_PAGE_PAD, 1);
      const additionalPagesForSearch = normalizedQuery ? 4 : 0;
      const maxPageFetch = Math.min(
        targetPageCount + additionalPagesForSearch,
        Math.ceil(MAX_RECENT_FETCH / ROOMS_PER_PAGE)
      );

      const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000);
      const recentConstraints = [
        where("lastActiveAt", ">=", Timestamp.fromDate(threeMinAgo)),
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
          : 3;
      // 進行中（clue/reveal）は時間に関わらず上位N件のみ取得
      // 🔧 複合インデックス問題回避: orderByを除去してクライアント側ソート
      const qInprog = query(
        roomsCol,
        where("status", "in", ["clue", "reveal"] as any),
        limit(Math.max(inprogLimit, ROOMS_PER_PAGE))
      );

      const now = Date.now();
      const filterValid = (room: LobbyRoom) => {
        const expMs = toMillis(room.expiresAt);
        if (expMs && expMs <= now) return false;
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
