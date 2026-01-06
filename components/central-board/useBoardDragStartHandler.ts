import { useCallback, type Dispatch, type SetStateAction, type MutableRefObject } from "react";
import type { DragStartEvent } from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";

import { traceAction } from "@/lib/utils/trace";
import { setMetric } from "@/lib/utils/metrics";
import type { RectLike } from "@/lib/ui/dragMagnet";

import { getActiveRectWithDelta } from "./dragRects";

export function useBoardDragStartHandler(params: {
  beginDropSession: () => void;
  updateBoardBounds: () => void;
  updateDropAnimationTarget: (
    rect: RectLike | null,
    options?: { magnetSnap?: boolean }
  ) => void;
  resetMagnet: (options?: { immediate?: boolean }) => void;
  dragActivationStartRef: MutableRefObject<number | null>;
  setActiveId: Dispatch<SetStateAction<string | null>>;
  setDragBoostEnabled: Dispatch<SetStateAction<boolean>>;
  playDragPickup: () => void;
  setCursorSnapOffset: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
}) {
  const {
    beginDropSession,
    updateBoardBounds,
    updateDropAnimationTarget,
    resetMagnet,
    dragActivationStartRef,
    setActiveId,
    setDragBoostEnabled,
    playDragPickup,
    setCursorSnapOffset,
  } = params;

  return useCallback(
    (event: DragStartEvent) => {
      traceAction("drag.start", { activeId: String(event.active.id) });
      beginDropSession();
      updateBoardBounds();
      updateDropAnimationTarget(null);
      resetMagnet({ immediate: true });
      setActiveId(String(event.active.id));
      setDragBoostEnabled((prev) => (prev ? prev : true));
      if (dragActivationStartRef.current !== null && typeof performance !== "undefined") {
        const latency = Math.max(0, performance.now() - dragActivationStartRef.current);
        setMetric("drag", "activationLatencyMs", Math.round(latency));
      }
      dragActivationStartRef.current = null;
      playDragPickup();
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate(6);
        } catch {
          // 触覚フィードバックの失敗は無視
        }
      }

      const coordinates = event.activatorEvent ? getEventCoordinates(event.activatorEvent) : null;
      const activeRect = getActiveRectWithDelta(event.active);
      if (coordinates && activeRect) {
        const centerX = activeRect.left + activeRect.width / 2;
        const centerY = activeRect.top + activeRect.height / 2;
        setCursorSnapOffset({
          x: coordinates.x - centerX,
          y: coordinates.y - centerY,
        });
      } else {
        setCursorSnapOffset(null);
      }
    },
    [
      beginDropSession,
      dragActivationStartRef,
      playDragPickup,
      resetMagnet,
      setActiveId,
      setCursorSnapOffset,
      setDragBoostEnabled,
      updateBoardBounds,
      updateDropAnimationTarget,
    ]
  );
}

