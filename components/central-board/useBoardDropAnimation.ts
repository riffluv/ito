import { useCallback, useMemo, useRef } from "react";
import type { DropAnimation, DropAnimationKeyframeResolver } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import type { RectLike } from "@/lib/ui/dragMagnet";
import { UI_TOKENS } from "@/theme/layout";

import { snapshotRect } from "./dragRects";

export function useBoardDropAnimation(params: {
  prefersReducedMotion: boolean;
}): {
  dropAnimation: DropAnimation;
  updateDropAnimationTarget: (
    rect: RectLike | null,
    options?: { magnetSnap?: boolean }
  ) => void;
} {
  const { prefersReducedMotion } = params;

  const dropAnimationTargetRef = useRef<RectLike | null>(null);
  const dropAnimationMetaRef = useRef<{ magnetSnap: boolean }>({ magnetSnap: false });

  const updateDropAnimationTarget = useCallback(
    (rect: RectLike | null, options?: { magnetSnap?: boolean }) => {
      if (rect) {
        dropAnimationTargetRef.current = snapshotRect(rect);
        dropAnimationMetaRef.current = {
          magnetSnap: Boolean(options?.magnetSnap),
        };
        return;
      }
      dropAnimationTargetRef.current = null;
      dropAnimationMetaRef.current = { magnetSnap: false };
    },
    []
  );

  const resolveDropAnimationKeyframes = useCallback<DropAnimationKeyframeResolver>(
    ({ dragOverlay, transform }) => {
      const overlayRect = dragOverlay?.rect ?? null;
      const target = dropAnimationTargetRef.current;
      const magnetSnap = dropAnimationMetaRef.current.magnetSnap;
      const defaultFrames = [
        { transform: CSS.Transform.toString(transform.initial) },
        { transform: CSS.Transform.toString(transform.final) },
      ];
      if (!target || !overlayRect) {
        return defaultFrames;
      }

      const deltaX = target.left - overlayRect.left;
      const deltaY = target.top - overlayRect.top;
      const finalTransform = {
        ...transform.initial,
        x: transform.initial.x + deltaX,
        y: transform.initial.y + deltaY,
        scaleX: 1,
        scaleY: 1,
      };

      if (prefersReducedMotion || !magnetSnap) {
        return [
          { transform: CSS.Transform.toString(transform.initial) },
          { transform: CSS.Transform.toString(finalTransform) },
        ];
      }

      return [
        { transform: CSS.Transform.toString(transform.initial) },
        {
          transform: CSS.Transform.toString({
            ...finalTransform,
            scaleX: 1.06,
            scaleY: 1.06,
          }),
        },
        { transform: CSS.Transform.toString(finalTransform) },
      ];
    },
    [prefersReducedMotion]
  );

  const dropAnimation = useMemo<DropAnimation>(() => {
    if (prefersReducedMotion) {
      return {
        duration: 110,
        easing: "linear",
        keyframes: resolveDropAnimationKeyframes,
      };
    }
    return {
      duration: 220,
      easing: UI_TOKENS.EASING.standard,
      keyframes: resolveDropAnimationKeyframes,
    };
  }, [prefersReducedMotion, resolveDropAnimationKeyframes]);

  return { dropAnimation, updateDropAnimationTarget };
}

