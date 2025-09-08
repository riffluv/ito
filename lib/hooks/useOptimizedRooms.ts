import { useState, useEffect } from "react";
import { collection, getDocs, orderBy, query, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { roomConverter } from "@/lib/types";

/**
 * 🔧 Firebase読み取り最適化版 - useRooms
 * onSnapshotの常時監視を削減し、アクティブルームのみ取得
 */
export function useOptimizedRooms(enabled: boolean) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !db) {
      setRooms([]);
      return;
    }

    let mounted = true;

    const fetchActiveRooms = async () => {
      if (!mounted) return;
      
      setLoading(true);
      setError(null);

      try {
        // 🎯 アクティブなルームのみ取得（過去24時間以内）
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        const q = query(
          collection(db!, "rooms").withConverter(roomConverter),
          where("lastActiveAt", ">=", Timestamp.fromDate(yesterday)),
          orderBy("lastActiveAt", "desc")
        );

        const snapshot = await getDocs(q);
        const activeRooms = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        if (mounted) {
          setRooms(activeRooms);
        }
      } catch (err: any) {
        console.error("Failed to fetch rooms:", err);
        if (mounted) {
          setError(err);
          setRooms([]); // フォールバック
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // 初回取得
    fetchActiveRooms();

    // 🔥 更新頻度を大幅削減: リアルタイム→5分間隔
    const interval = setInterval(fetchActiveRooms, 5 * 60 * 1000); // 5分

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [enabled]);

  return { rooms, loading, error };
}