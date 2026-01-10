import { useCallback, type MutableRefObject } from "react";
import type { RectLike } from "@/lib/ui/dragMagnet";
import { traceAction } from "@/lib/utils/trace";
import { bumpMetric, setMetric } from "@/lib/utils/metrics";

import { useActiveDragCancelFallback, type ActiveDragCancelReason } from "./useActiveDragCancelFallback";

export function useBoardDragCancelHandlers(params: {
  activeId: string | null;
  dragActivationStartRef: MutableRefObject<number | null>;
  dragSessionStartRef: MutableRefObject<number | null>;
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
    dragSessionStartRef,
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
      bumpMetric("drag", "cancels", 1);
      setMetric("drag", "lastCancelAt", Date.now());
      setMetric("drag", "lastOutcome", "cancel");
      setMetric("drag", "lastOutcomeReason", reason);
      if (typeof performance !== "undefined" && dragSessionStartRef.current !== null) {
        const durationMs = Math.max(0, performance.now() - dragSessionStartRef.current);
        setMetric("drag", "lastSessionMs", Math.round(durationMs));
      }
      dragSessionStartRef.current = null;
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
      dragSessionStartRef,
      endDropSession,
      updateDropAnimationTarget,
    ]
  );

  useActiveDragCancelFallback({ activeId, cancel: cancelActiveDrag });

  const onDragCancel = useCallback(() => {
    traceAction("drag.cancel");
    bumpMetric("drag", "cancels", 1);
    setMetric("drag", "lastCancelAt", Date.now());
    setMetric("drag", "lastOutcome", "cancel");
    setMetric("drag", "lastOutcomeReason", "explicit");
    if (typeof performance !== "undefined" && dragSessionStartRef.current !== null) {
      const durationMs = Math.max(0, performance.now() - dragSessionStartRef.current);
      setMetric("drag", "lastSessionMs", Math.round(durationMs));
    }
    dragSessionStartRef.current = null;
    dragActivationStartRef.current = null;
    updateDropAnimationTarget(null);
    cancelPendingDragMove();
    clearActive();
    endDropSession();
  }, [
    cancelPendingDragMove,
    clearActive,
    dragActivationStartRef,
    dragSessionStartRef,
    endDropSession,
    updateDropAnimationTarget,
  ]);

  return { onDragCancel };
}
