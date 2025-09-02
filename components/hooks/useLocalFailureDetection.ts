import type { PlayerDoc } from "@/lib/types";
import { useMemo } from "react";

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

  const { localFailedAt, boundaryPreviousIndex } = useMemo((): {
    localFailedAt: number | null;
    boundaryPreviousIndex: number | null;
  } => {
    if (resolveMode === "sort-submit")
      return { localFailedAt: null, boundaryPreviousIndex: null };

    // 🎯 ネタバレ防止: 2枚以上出ている場合のみ失敗判定
    // 1枚目の場合は、まだ他の人の数字が見えていないため判定不可
    if ((currentPlaced.length || 0) < 2)
      return { localFailedAt: null, boundaryPreviousIndex: null };

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
      if (a.number > b.number) {
        return { localFailedAt: i + 1, boundaryPreviousIndex: i }; // both 1-based fail index & 0-based previous
      }
    }
    return { localFailedAt: null, boundaryPreviousIndex: null };
  }, [currentPlaced.join(","), players.map((p) => p.number).join(",")]);

  return { localFailedAt, boundaryPreviousIndex };
}
