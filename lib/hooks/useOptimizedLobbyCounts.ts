import { useState, useEffect } from "react";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

/**
 * 🔧 Firebase読み取り最適化版
 * onSnapshotの常時監視を削減し、必要時のみ読み取り
 */
export function useOptimizedLobbyCounts(roomIds: string[], enabled: boolean) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !db || roomIds.length === 0) {
      setCounts({});
      return;
    }

    let mounted = true;
    
    // 🎯 定期的な読み取りに変更（常時監視を停止）
    const fetchCounts = async () => {
      if (!mounted) return;
      
      setLoading(true);
      const newCounts: Record<string, number> = {};

      try {
        // 並列で効率的に取得
        await Promise.all(
          roomIds.map(async (roomId) => {
            try {
              const playersSnap = await getDocs(
                collection(db!, "rooms", roomId, "players")
              );
              newCounts[roomId] = playersSnap.size;
            } catch (error) {
              console.warn(`Failed to get count for room ${roomId}:`, error);
              newCounts[roomId] = 0;
            }
          })
        );

        if (mounted) {
          setCounts(newCounts);
        }
      } catch (error) {
        console.error("Failed to fetch lobby counts:", error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // 初回取得
    fetchCounts();

    // 🔥 読み取り頻度を大幅削減: 30秒→3分間隔
    const interval = setInterval(fetchCounts, 3 * 60 * 1000); // 3分

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [roomIds.join(","), enabled]);

  return { counts, loading };
}