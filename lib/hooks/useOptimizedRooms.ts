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
import { useEffect, useState } from "react";

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

/**
 * 🔧 Firebase読み取り最適化版 - useRooms
 * onSnapshotの常時監視を削減し、アクティブルームのみ取得
 */
export function useOptimizedRooms(enabled: boolean) {
  const [rooms, setRooms] = useState<RoomWithHost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchRef = { current: 0 } as { current: number };

  // fetchActiveRooms を useEffect 外で定義して refresh で使えるように
  const fetchActiveRooms = async () => {
    if (!enabled || !db) return;

    setLoading(true);
    setError(null);

    try {
      // 🚨 緊急読み取り削減: 直近3分のみに制限
      const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000);
      const roomsCol = collection(db!, "rooms").withConverter(roomConverter);
      const qRecent = query(
        roomsCol,
        where("lastActiveAt", ">=", Timestamp.fromDate(threeMinAgo)),
        orderBy("lastActiveAt", "desc"),
        limit(5) // 🚨 20 → 5に削減
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
        limit(inprogLimit)
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
      setRooms(Array.from(map.values()));
      lastFetchRef.current = Date.now();
    } catch (err: any) {
      // Firebase制限エラー専用処理
      if (isFirebaseQuotaExceeded(err)) {
        handleFirebaseQuotaError("ルーム一覧取得");
      } else {
        logError("useOptimizedRooms", "fetch-failed", err);
      }
      setError(err);
      setRooms([]); // フォールバック
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled || !db) {
      setRooms([]);
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
    let interval: any = null;
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
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [enabled]);

  const refresh = () => {
    fetchActiveRooms();
  };

  return { rooms, loading, error, refresh };
}