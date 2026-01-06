import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import type { DragMoveEvent } from "@dnd-kit/core";

import type { RoomDoc } from "@/lib/types";
import {
  computeMagnetTransform,
  type MagnetConfig,
  type MagnetResult,
} from "@/lib/ui/dragMagnet";

import { MAGNET_IDLE_MARGIN_PX } from "./constants";
import { getActiveRectWithDelta } from "./dragRects";

export function useBoardDragMoveHandler(params: {
  resolveMode: string | null | undefined;
  roomStatus: RoomDoc["status"];
  boardBoundsRef: MutableRefObject<DOMRect | null>;
  lastDragPositionRef: MutableRefObject<{ x: number; y: number } | null>;
  magnetConfigRef: MutableRefObject<MagnetConfig>;
  cursorSnapOffset: { x: number; y: number } | null;
  scheduleMagnetTarget: (nextId: string | null) => void;
  getProjectedMagnetState: () => MagnetResult;
  enqueueMagnetUpdate: (update: { state: MagnetResult }) => void;
  releaseMagnet: () => void;
}): { onDragMove: (event: DragMoveEvent) => void; cancelPendingDragMove: () => void } {
  const {
    resolveMode,
    roomStatus,
    boardBoundsRef,
    lastDragPositionRef,
    magnetConfigRef,
    cursorSnapOffset,
    scheduleMagnetTarget,
    getProjectedMagnetState,
    enqueueMagnetUpdate,
    releaseMagnet,
  } = params;

  const latestDragMoveEventRef = useRef<DragMoveEvent | null>(null);
  const dragMoveRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (dragMoveRafRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(dragMoveRafRef.current);
        dragMoveRafRef.current = null;
      }
      latestDragMoveEventRef.current = null;
    };
  }, []);

  const processDragMoveFrame = useCallback(
    (event: DragMoveEvent) => {
      if (resolveMode !== "sort-submit" || roomStatus !== "clue") {
        return;
      }

      const { over, active } = event;
      const activeRect = getActiveRectWithDelta(active, event.delta);
      if (activeRect) {
        lastDragPositionRef.current = {
          x: activeRect.left + activeRect.width / 2,
          y: activeRect.top + activeRect.height / 2,
        };
      }

      const dragPoint = lastDragPositionRef.current;
      const boardBounds = boardBoundsRef.current;
      if (
        boardBounds &&
        dragPoint &&
        (dragPoint.y < boardBounds.top - MAGNET_IDLE_MARGIN_PX ||
          dragPoint.y > boardBounds.bottom + MAGNET_IDLE_MARGIN_PX)
      ) {
        releaseMagnet();
        return;
      }

      if (!over || typeof over.id !== "string" || !over.id.startsWith("slot-")) {
        releaseMagnet();
        return;
      }

      scheduleMagnetTarget(String(over.id));

      const projectedState = getProjectedMagnetState();
      const magnetResult = computeMagnetTransform(over.rect, activeRect, {
        ...magnetConfigRef.current,
        projectedOffset: {
          dx: projectedState.dx + (cursorSnapOffset?.x ?? 0),
          dy: projectedState.dy + (cursorSnapOffset?.y ?? 0),
        },
      });

      const previous = projectedState;
      const deltaX = Math.abs(previous.dx - magnetResult.dx);
      const deltaY = Math.abs(previous.dy - magnetResult.dy);
      const deltaStrength = Math.abs(previous.strength - magnetResult.strength);
      if (
        deltaX < 0.5 &&
        deltaY < 0.5 &&
        deltaStrength < 0.05 &&
        previous.shouldSnap === magnetResult.shouldSnap
      ) {
        return;
      }

      enqueueMagnetUpdate({ state: magnetResult });
    },
    [
      boardBoundsRef,
      cursorSnapOffset,
      enqueueMagnetUpdate,
      getProjectedMagnetState,
      lastDragPositionRef,
      magnetConfigRef,
      releaseMagnet,
      resolveMode,
      roomStatus,
      scheduleMagnetTarget,
    ]
  );

  const flushPendingDragMove = useCallback(() => {
    dragMoveRafRef.current = null;
    const pending = latestDragMoveEventRef.current;
    if (!pending) {
      return;
    }
    latestDragMoveEventRef.current = null;
    processDragMoveFrame(pending);
  }, [processDragMoveFrame]);

  const onDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (typeof window === "undefined") {
        processDragMoveFrame(event);
        return;
      }

      latestDragMoveEventRef.current = event;
      if (dragMoveRafRef.current !== null) {
        return;
      }
      dragMoveRafRef.current = window.requestAnimationFrame(flushPendingDragMove);
    },
    [flushPendingDragMove, processDragMoveFrame]
  );

  const cancelPendingDragMove = useCallback(() => {
    if (typeof window !== "undefined" && dragMoveRafRef.current !== null) {
      window.cancelAnimationFrame(dragMoveRafRef.current);
      dragMoveRafRef.current = null;
    }
    latestDragMoveEventRef.current = null;
  }, []);

  return { onDragMove, cancelPendingDragMove };
}

