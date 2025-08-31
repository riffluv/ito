import { useMemo } from "react";
import type { PlayerDoc } from "@/lib/types";

interface UseLocalFailureDetectionProps {
  currentPlaced: string[];
  players: (PlayerDoc & { id: string })[];
  resolveMode?: string;
}

export function useLocalFailureDetection({
  currentPlaced,
  players,
  resolveMode,
}: UseLocalFailureDetectionProps) {
  const map = new Map(players.map((p) => [p.id, p]));

  const localFailedAt = useMemo(() => {
    if (resolveMode === "sort-submit") return null;
    
    // 🎯 ネタバレ防止: 2枚以上出ている場合のみ失敗判定
    // 1枚目の場合は、まだ他の人の数字が見えていないため判定不可
    if ((currentPlaced.length || 0) < 2) return null;
    
    for (let i = 0; i < (currentPlaced.length || 0) - 1; i++) {
      const a = map.get(currentPlaced[i]) as any;
      const b = map.get(currentPlaced[i + 1]) as any;
      
      if (
        !a ||
        !b ||
        typeof a.number !== "number" ||
        typeof b.number !== "number"
      )
        continue;
      
      // 既に出ているカード間でのみ失敗判定
      if (a.number > b.number) return i + 1; // 1-based
    }
    return null;
  }, [currentPlaced.join(","), players.map((p) => p.number).join(",")]);

  return { localFailedAt };
}