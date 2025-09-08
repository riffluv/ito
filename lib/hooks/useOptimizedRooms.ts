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

/**
 * 🔧 Firebase読み取り最適化版 - useRooms
 * onSnapshotの常時監視を削減し、アクティブルームのみ取得
 */
export function useOptimizedRooms(enabled: boolean) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // fetchActiveRooms を useEffect 外で定義して refresh で使えるように
  const fetchActiveRooms = async () => {
    if (!enabled || !db) return;

    setLoading(true);
    setError(null);

    try {
      // 🎯 アクティブなルームのみ取得
      // - 待機中(waiting) かつ 期限切れでない
      // - もしくは直近24時間にアクティブ
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const roomsCol = collection(db!, "rooms").withConverter(roomConverter);

      // Firestoreの複合クエリ制限を避けるため単純な条件で取得し、後でクライアント側で軽くフィルタ
      const q = query(
        roomsCol,
        where("lastActiveAt", ">=", Timestamp.fromDate(yesterday)),
        orderBy("lastActiveAt", "desc"),
        limit(30)
        // 取得上限を設けて、ロビー画面での読み取りを抑制
        // 将来的には status=="waiting" を含む複合インデックスで更に絞り込み
      );

      const snapshot = await getDocs(q);
      // `withConverter(roomConverter)` already includes `id` in `fromFirestore`.
      // Avoid duplicate `id` property which causes a TypeScript error.
      const activeRooms = snapshot.docs
        .map((doc) => doc.data())
        .filter((r: any) => {
          const now = Date.now();
          const exp = (r as any).expiresAt;
          const expMs =
            typeof exp?.toMillis === "function" ? exp.toMillis() : 0;
          if (expMs && expMs <= now) return false; // 期限切れ除外
          return true;
        });

      setRooms(activeRooms);
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

    // 🔥 更新頻度: Firebase制限を考慮しつつユーザビリティ重視で30秒間隔
    const interval = setInterval(wrappedFetch, 30 * 1000); // 30秒

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [enabled]);

  const refresh = () => {
    fetchActiveRooms();
  };

  return { rooms, loading, error, refresh };
}
