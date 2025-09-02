import { useState, useCallback } from "react";

/**
 * フリップ状態管理専用hook - カードのflip状態とrevealIndexを管理
 * useSequentialRevealから抽出した純粋なState管理ロジック
 */
export function useFlipState() {
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());
  const [revealIndex, setRevealIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  const addFlippedId = useCallback((id: string) => {
    setFlippedIds((prev) => {
      if (prev.has(id)) return prev; // 冪等性保証
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
  }, []);

  const resetFlipState = useCallback(() => {
    setFlippedIds(new Set());
    setRevealIndex(0);
    setAnimating(false);
  }, []);

  const setFullFlip = useCallback((ids: string[]) => {
    const fullSet = new Set(ids);
    setFlippedIds(fullSet);
    setRevealIndex(fullSet.size);
    setAnimating(false);
  }, []);

  const updateRevealIndex = useCallback(() => {
    setRevealIndex(flippedIds.size);
  }, [flippedIds.size]);

  return {
    flippedIds,
    revealIndex,
    animating,
    setAnimating,
    addFlippedId,
    resetFlipState,
    setFullFlip,
    updateRevealIndex,
    setRevealIndex
  };
}

export default useFlipState;