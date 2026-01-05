import { useCallback, useEffect, useRef, useState } from "react";

export function useResolvedSlotCount(params: {
  slotCountTarget: number;
  prefersReducedMotion: boolean;
}): {
  resolvedSlotCount: number;
  beginDropSession: () => void;
  endDropSession: () => void;
} {
  const { slotCountTarget, prefersReducedMotion } = params;

  const [resolvedSlotCount, setResolvedSlotCount] = useState(() =>
    Math.max(0, slotCountTarget)
  );

  const dropSessionFloorRef = useRef(0);
  const dropSessionActiveRef = useRef(false);
  const dropSessionClearTimerRef = useRef<number | null>(null);
  const lowerHysteresisTimerRef = useRef<number | null>(null);
  const lastLowerTargetRef = useRef<number | null>(null);

  const beginDropSession = useCallback(() => {
    if (dropSessionClearTimerRef.current !== null) {
      clearTimeout(dropSessionClearTimerRef.current);
      dropSessionClearTimerRef.current = null;
    }
    dropSessionActiveRef.current = true;
    dropSessionFloorRef.current = Math.max(
      dropSessionFloorRef.current,
      slotCountTarget,
      resolvedSlotCount
    );
  }, [resolvedSlotCount, slotCountTarget]);

  const endDropSession = useCallback(() => {
    if (dropSessionClearTimerRef.current !== null) {
      clearTimeout(dropSessionClearTimerRef.current);
    }
    const delay = prefersReducedMotion ? 160 : 260;
    dropSessionClearTimerRef.current = window.setTimeout(() => {
      dropSessionActiveRef.current = false;
      dropSessionFloorRef.current = 0;
      dropSessionClearTimerRef.current = null;
    }, delay);
  }, [prefersReducedMotion]);

  useEffect(() => {
    const effectiveTarget = dropSessionActiveRef.current
      ? Math.max(slotCountTarget, dropSessionFloorRef.current)
      : slotCountTarget;

    const clearLowerTimer = () => {
      if (lowerHysteresisTimerRef.current !== null) {
        clearTimeout(lowerHysteresisTimerRef.current);
        lowerHysteresisTimerRef.current = null;
      }
    };

    // 上振れ or 同値: 即時反映 + タイマーリセット
    if (effectiveTarget >= resolvedSlotCount) {
      clearLowerTimer();
      lastLowerTargetRef.current = null;
      if (effectiveTarget !== resolvedSlotCount) {
        setResolvedSlotCount(effectiveTarget);
      }
      return;
    }

    // 下振れ: 一定時間（~700ms）安定したら縮める
    if (lastLowerTargetRef.current !== effectiveTarget) {
      clearLowerTimer();
      lastLowerTargetRef.current = effectiveTarget;
      const delay = prefersReducedMotion ? 500 : 700;
      lowerHysteresisTimerRef.current = window.setTimeout(() => {
        setResolvedSlotCount((prev) => {
          // タイマー中に再度上振れしていないかチェック
          const freshTarget = dropSessionActiveRef.current
            ? Math.max(slotCountTarget, dropSessionFloorRef.current)
            : slotCountTarget;
          const finalTarget = Math.min(prev, freshTarget);
          return finalTarget;
        });
        lowerHysteresisTimerRef.current = null;
      }, delay);
    }
  }, [slotCountTarget, resolvedSlotCount, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (dropSessionClearTimerRef.current !== null) {
        clearTimeout(dropSessionClearTimerRef.current);
      }
      if (lowerHysteresisTimerRef.current !== null) {
        clearTimeout(lowerHysteresisTimerRef.current);
      }
    };
  }, []);

  return { resolvedSlotCount, beginDropSession, endDropSession };
}

