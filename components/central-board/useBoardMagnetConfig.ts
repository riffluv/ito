import { useMemo } from "react";
import type { MagnetConfig } from "@/lib/ui/dragMagnet";
import type { PointerProfile } from "@/lib/hooks/usePointerProfile";

export function useBoardMagnetConfig(params: {
  pointerProfile: PointerProfile;
  prefersReducedMotion: boolean;
}): MagnetConfig {
  const { pointerProfile, prefersReducedMotion } = params;
  const { isCoarsePointer, isTouchOnly } = pointerProfile;

  return useMemo(() => {
    const isTouchLike = isTouchOnly || isCoarsePointer;
    // 全スロットで同じ立ち上がり時間になるよう、吸着開始距離を広めに統一
    const snapRadius = prefersReducedMotion ? 140 : isTouchLike ? 220 : 190;
    const snapThreshold = prefersReducedMotion ? 28 : isTouchLike ? 32 : 26;
    // 遠距離からの立ち上がりをなだらかにし、スロット1と同じ“溜め”を作る
    const pullExponent = prefersReducedMotion ? 1.45 : 1.7;
    const settleProgress = prefersReducedMotion ? 0.9 : 0.78;
    const overshootStart = prefersReducedMotion ? 0.94 : 0.9;
    const overshootRatio = prefersReducedMotion ? 0.04 : 0.08;
    const maxOvershootPx = prefersReducedMotion ? 7 : 12;
    return {
      snapRadius,
      snapThreshold,
      pullExponent,
      settleProgress,
      overshootStart,
      overshootRatio,
      maxOvershootPx,
      isTouch: isTouchLike,
    };
  }, [isCoarsePointer, isTouchOnly, prefersReducedMotion]);
}

