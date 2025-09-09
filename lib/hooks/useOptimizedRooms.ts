import { db } from "@/lib/firebase/client";
import { roomConverter } from "@/lib/firebase/converters";
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
      // 読み取り削減: 直近10分のみ対象
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
      const roomsCol = collection(db!, "rooms").withConverter(roomConverter);
      const q = query(
        roomsCol,
        where("lastActiveAt", ">=", Timestamp.fromDate(tenMinAgo)),
        orderBy("lastActiveAt", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      const activeRooms = snap.docs
        .map((d) => d.data() as any)
        .filter((r: any) => {
          const now = Date.now();
          const exp = (r as any).expiresAt;
          const expMs =
            typeof exp?.toMillis === "function" ? exp.toMillis() : 0;
          if (expMs && expMs <= now) return false;
          return true;
        });
      setRooms(activeRooms);
      lastFetchRef.current = Date.now();
    } catch (err: any) {
      console.error("Failed to fetch rooms:", err);
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
      if (now - lastFetchRef.current < 60 * 1000) return; // 60秒クールダウン
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
