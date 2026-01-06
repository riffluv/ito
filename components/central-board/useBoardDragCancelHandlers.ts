import { useCallback, type MutableRefObject } from "react";
import type { RectLike } from "@/lib/ui/dragMagnet";
import { traceAction } from "@/lib/utils/trace";

import { useActiveDragCancelFallback, type ActiveDragCancelReason } from "./useActiveDragCancelFallback";

export function useBoardDragCancelHandlers(params: {
  activeId: string | null;
  dragActivationStartRef: MutableRefObject<number | null>;
  updateDropAnimationTarget: (
    rect: RectLike | null,
    options?: { magnetSnap?: boolean }
  ) => void;
  cancelPendingDragMove: () => void;
  clearActive: (options?: { delayMagnetReset?: boolean }) => void;
  endDropSession: () => void;
}): { onDragCancel: () => void } {
  const {
    activeId,
    dragActivationStartRef,
    updateDropAnimationTarget,
    cancelPendingDragMove,
    clearActive,
    endDropSession,
  } = params;

  const cancelActiveDrag = useCallback(
    (reason: ActiveDragCancelReason) => {
      if (!activeId) return;
      traceAction("drag.cancel.fallback", {
        activeId: String(activeId),
        reason,
      });
      dragActivationStartRef.current = null;
      updateDropAnimationTarget(null);
      cancelPendingDragMove();
      clearActive();
      endDropSession();
    },
    [
      activeId,
      cancelPendingDragMove,
      clearActive,
      dragActivationStartRef,
      endDropSession,
      updateDropAnimationTarget,
    ]
  );

  useActiveDragCancelFallback({ activeId, cancel: cancelActiveDrag });

  const onDragCancel = useCallback(() => {
    traceAction("drag.cancel");
    dragActivationStartRef.current = null;
    updateDropAnimationTarget(null);
    cancelPendingDragMove();
    clearActive();
    endDropSession();
  }, [
    cancelPendingDragMove,
    clearActive,
    dragActivationStartRef,
    endDropSession,
    updateDropAnimationTarget,
  ]);

  return { onDragCancel };
}

