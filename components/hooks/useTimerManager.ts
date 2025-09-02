import { useRef, useCallback } from "react";

/**
 * Timer管理専用hook - 安全にタイマーの作成・クリアを管理
 * useSequentialRevealから抽出した純粋なTimer管理ロジック
 */
export function useTimerManager() {
  const timersRef = useRef<number[]>([]);

  const addTimer = useCallback((timer: number) => {
    timersRef.current.push(timer);
  }, []);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const clearAndReset = useCallback(() => {
    clearAllTimers();
    timersRef.current = [];
  }, [clearAllTimers]);

  return {
    addTimer,
    clearAllTimers,
    clearAndReset
  };
}

export default useTimerManager;