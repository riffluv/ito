"use client";

export type DragMagnetConfig = {
  snapRadius: number;
  snapThreshold: number;
  pullExponent: number;
  settleProgress: number;
  overshootStart: number;
  overshootRatio: number;
  maxOvershootPx: number;
  isTouch: boolean;
};

export function buildDragMagnetConfig(params: {
  prefersReducedMotion: boolean;
  isTouchOnly: boolean;
  isCoarsePointer: boolean;
}): DragMagnetConfig {
  const { prefersReducedMotion, isTouchOnly, isCoarsePointer } = params;
  const isTouchLike = isTouchOnly || isCoarsePointer;
  const snapRadius = prefersReducedMotion ? 96 : isTouchLike ? 168 : 132;
  const snapThreshold = isTouchLike ? (prefersReducedMotion ? 34 : 30) : 24;
  const pullExponent = prefersReducedMotion ? 1.5 : isTouchLike ? 2.35 : 1.85;
  const settleProgress = prefersReducedMotion ? 0.9 : 0.8;
  const overshootStart = prefersReducedMotion ? 0.95 : 0.88;
  const overshootRatio = prefersReducedMotion ? 0.04 : isTouchLike ? 0.07 : 0.1;
  const maxOvershootPx = prefersReducedMotion ? 6 : 12;
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
}

export function buildMouseSensorOptions(params: {
  dragBoostEnabled: boolean;
  isCoarsePointer: boolean;
}) {
  const { dragBoostEnabled, isCoarsePointer } = params;
  return {
    activationConstraint: {
      distance: dragBoostEnabled ? 1 : isCoarsePointer ? 6 : 2,
    },
  };
}

export function buildTouchSensorOptions(params: {
  dragBoostEnabled: boolean;
  isTouchOnly: boolean;
}) {
  const { dragBoostEnabled, isTouchOnly } = params;
  const base = isTouchOnly
    ? {
        delay: 45,
        tolerance: 26,
      }
    : {
        delay: 160,
        tolerance: 8,
      };
  if (!dragBoostEnabled) {
    return { activationConstraint: base };
  }
  return {
    activationConstraint: {
      delay: Math.max(12, Math.round(base.delay * 0.35)),
      tolerance: base.tolerance + 6,
    },
  };
}

export function getMagnetHighlightDelayMs(prefersReducedMotion: boolean) {
  return prefersReducedMotion ? 36 : 90;
}

export function getMagnetDwellThresholdMs(params: {
  prefersReducedMotion: boolean;
  isCoarsePointer: boolean;
}) {
  const { prefersReducedMotion, isCoarsePointer } = params;
  return prefersReducedMotion ? 70 : isCoarsePointer ? 110 : 55;
}

export function getMagnetThrottleParams(params: {
  prefersReducedMotion: boolean;
  isCoarsePointer: boolean;
}) {
  const { prefersReducedMotion, isCoarsePointer } = params;
  return {
    fastDistance: isCoarsePointer ? 18 : 26,
    fastThreshold: prefersReducedMotion ? 1.0 : isCoarsePointer ? 1.2 : 1.6,
  };
}

