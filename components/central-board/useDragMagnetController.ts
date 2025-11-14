"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type DragMoveEvent,
  type DropAnimation,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import type { ResolveMode } from "@/lib/game/resolveMode";
import type { RoomDoc } from "@/lib/types";
import { computeMagnetTransform, type MagnetResult } from "@/lib/ui/dragMagnet";
import type { PointerProfile } from "@/lib/hooks/usePointerProfile";
import { UI_TOKENS } from "@/theme/layout";

import { createInitialMagnetState, MAGNET_IDLE_MARGIN_PX } from "./constants";

interface UseDragMagnetControllerOptions {
  prefersReducedMotion: boolean;
  pointerProfile: PointerProfile;
  roomStatus: RoomDoc["status"];
  resolveMode?: ResolveMode | null;
}

export function useDragMagnetController({
  prefersReducedMotion,
  pointerProfile,
  roomStatus,
  resolveMode,
}: UseDragMagnetControllerOptions) {
  const [magnetState, setMagnetState] = useState<MagnetResult>(() => createInitialMagnetState());
  const magnetStateRef = useRef(magnetState);
  useEffect(() => {
    magnetStateRef.current = magnetState;
  }, [magnetState]);

  const [magnetTargetId, setMagnetTargetId] = useState<string | null>(null);
  const magnetTargetRef = useRef<string | null>(null);
  const magnetHighlightTimeoutRef = useRef<number | null>(null);
  const pendingMagnetStateRef = useRef<MagnetResult | null>(null);
  const pendingMagnetTargetIdRef = useRef<string | null | undefined>(undefined);
  const magnetFlushFrameRef = useRef<number | null>(null);

  const magnetConfig = useMemo(() => {
    const isTouchLike = pointerProfile.isTouchOnly || pointerProfile.isCoarsePointer;
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
  }, [prefersReducedMotion, pointerProfile.isCoarsePointer, pointerProfile.isTouchOnly]);
  const magnetConfigRef = useRef(magnetConfig);
  useEffect(() => {
    magnetConfigRef.current = magnetConfig;
  }, [magnetConfig]);

  const flushMagnetUpdates = useCallback(() => {
    const nextState = pendingMagnetStateRef.current;
    const nextTarget = pendingMagnetTargetIdRef.current;
    pendingMagnetStateRef.current = null;
    pendingMagnetTargetIdRef.current = undefined;
    if (nextState) {
      magnetStateRef.current = nextState;
      setMagnetState(nextState);
    }
    if (nextTarget !== undefined) {
      magnetTargetRef.current = nextTarget;
      setMagnetTargetId(nextTarget);
    }
  }, []);

  const scheduleMagnetFlush = useCallback(
    (options?: { immediate?: boolean }) => {
      const immediate = options?.immediate ?? false;
      if (immediate || typeof window === "undefined") {
        if (typeof window !== "undefined" && magnetFlushFrameRef.current !== null) {
          window.cancelAnimationFrame(magnetFlushFrameRef.current);
        }
        magnetFlushFrameRef.current = null;
        flushMagnetUpdates();
        return;
      }
      if (magnetFlushFrameRef.current !== null) return;
      magnetFlushFrameRef.current = window.requestAnimationFrame(() => {
        magnetFlushFrameRef.current = null;
        flushMagnetUpdates();
      });
    },
    [flushMagnetUpdates]
  );

  const enqueueMagnetUpdate = useCallback(
    (update: { state?: MagnetResult; target?: string | null; immediate?: boolean }) => {
      let didQueue = false;
      if (update.state) {
        pendingMagnetStateRef.current = update.state;
        didQueue = true;
      }
      if (Object.prototype.hasOwnProperty.call(update, "target")) {
        pendingMagnetTargetIdRef.current = update.target;
        didQueue = true;
      }
      if (!didQueue) return;
      scheduleMagnetFlush({ immediate: update.immediate });
    },
    [scheduleMagnetFlush]
  );

  const getProjectedMagnetTarget = useCallback(() => {
    return pendingMagnetTargetIdRef.current !== undefined
      ? pendingMagnetTargetIdRef.current
      : magnetTargetRef.current;
  }, []);

  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const [boardElement, setBoardElement] = useState<HTMLDivElement | null>(null);
  const boardBoundsRef = useRef<DOMRect | null>(null);
  const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const latestDragMoveEventRef = useRef<DragMoveEvent | null>(null);
  const dragMoveRafRef = useRef<number | null>(null);
  const dragActivationStartRef = useRef<number | null>(null);
  const [dragBoostEnabled, setDragBoostEnabled] = useState(false);

  const updateBoardBounds = useCallback(() => {
    if (!boardContainerRef.current) return;
    boardBoundsRef.current = boardContainerRef.current.getBoundingClientRect();
  }, []);

  useEffect(() => {
    return () => {
      if (dragMoveRafRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(dragMoveRafRef.current);
        dragMoveRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !boardElement) return;
    updateBoardBounds();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      updateBoardBounds();
    });
    observer.observe(boardElement);
    return () => {
      observer.disconnect();
    };
  }, [boardElement, updateBoardBounds]);

  const handleBoardRef = useCallback(
    (node: HTMLDivElement | null) => {
      boardContainerRef.current = node;
      setBoardElement(node);
      if (node) {
        updateBoardBounds();
      }
    },
    [updateBoardBounds]
  );

  useEffect(() => {
    if (typeof window === "undefined" || !boardElement) return;
    const handlePointerDown = () => {
      if (typeof performance !== "undefined") {
        dragActivationStartRef.current = performance.now();
      }
    };
    const clearPointerClock = () => {
      dragActivationStartRef.current = null;
    };
    boardElement.addEventListener("pointerdown", handlePointerDown, { passive: true });
    window.addEventListener("pointerup", clearPointerClock);
    window.addEventListener("pointercancel", clearPointerClock);
    return () => {
      boardElement.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", clearPointerClock);
      window.removeEventListener("pointercancel", clearPointerClock);
    };
  }, [boardElement]);

  useEffect(() => {
    if (roomStatus !== "clue" && dragBoostEnabled) {
      setDragBoostEnabled(false);
      dragActivationStartRef.current = null;
    }
  }, [roomStatus, dragBoostEnabled]);

  const resetMagnet = useCallback(
    (options?: { immediate?: boolean }) => {
      const immediate = options?.immediate ?? false;
      const projectedState = pendingMagnetStateRef.current ?? magnetStateRef.current;
      const projectedTarget = getProjectedMagnetTarget();
      const needsStateReset =
        projectedState.dx !== 0 ||
        projectedState.dy !== 0 ||
        projectedState.strength !== 0 ||
        projectedState.shouldSnap;
      const needsTargetReset = projectedTarget !== null;

      if (!needsStateReset && !needsTargetReset) {
        return;
      }

      if (typeof window !== "undefined" && magnetHighlightTimeoutRef.current !== null) {
        window.clearTimeout(magnetHighlightTimeoutRef.current);
        magnetHighlightTimeoutRef.current = null;
      }

      enqueueMagnetUpdate({
        state: needsStateReset ? createInitialMagnetState() : undefined,
        target: needsTargetReset ? null : undefined,
        immediate,
      });
    },
    [enqueueMagnetUpdate, getProjectedMagnetTarget]
  );

  const scheduleMagnetTarget = useCallback(
    (nextId: string | null) => {
      const projected = getProjectedMagnetTarget();
      if (projected === nextId) return;
      if (typeof window !== "undefined" && magnetHighlightTimeoutRef.current !== null) {
        window.clearTimeout(magnetHighlightTimeoutRef.current);
        magnetHighlightTimeoutRef.current = null;
      }

      if (typeof window === "undefined") {
        enqueueMagnetUpdate({ target: nextId, immediate: true });
        return;
      }

      const delay = prefersReducedMotion ? 36 : 90;
      if (delay <= 0) {
        enqueueMagnetUpdate({ target: nextId });
        return;
      }

      magnetHighlightTimeoutRef.current = window.setTimeout(() => {
        magnetHighlightTimeoutRef.current = null;
        enqueueMagnetUpdate({ target: nextId });
      }, delay);
    },
    [enqueueMagnetUpdate, getProjectedMagnetTarget, prefersReducedMotion]
  );

  const releaseMagnet = useCallback(() => {
    scheduleMagnetTarget(null);
    const projectedState = pendingMagnetStateRef.current ?? magnetStateRef.current;
    if (
      projectedState.dx !== 0 ||
      projectedState.dy !== 0 ||
      projectedState.strength > 0 ||
      projectedState.shouldSnap
    ) {
      enqueueMagnetUpdate({ state: createInitialMagnetState() });
    }
  }, [enqueueMagnetUpdate, scheduleMagnetTarget]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && magnetHighlightTimeoutRef.current !== null) {
        window.clearTimeout(magnetHighlightTimeoutRef.current);
        magnetHighlightTimeoutRef.current = null;
      }
      if (typeof window !== "undefined" && magnetFlushFrameRef.current !== null) {
        window.cancelAnimationFrame(magnetFlushFrameRef.current);
        magnetFlushFrameRef.current = null;
      }
    };
  }, []);

  const dropAnimation = useMemo<DropAnimation>(() => {
    if (prefersReducedMotion) {
      return { duration: 110, easing: "linear" };
    }
    if (magnetState.shouldSnap) {
      return {
        duration: 180,
        easing: "linear",
        keyframes: ({ transform }) => {
          const target = CSS.Transform.toString(transform.final);
          return [
            { transform: `${target} scale(0.98)` },
            { transform: `${target} scale(1.06)` },
            { transform: `${target} scale(1.0)` },
          ];
        },
      };
    }
    return { duration: 220, easing: UI_TOKENS.EASING.standard };
  }, [magnetState.shouldSnap, prefersReducedMotion]);

  const mouseSensorOptions = useMemo(
    () => ({
      activationConstraint: {
        distance: dragBoostEnabled ? 1 : pointerProfile.isCoarsePointer ? 6 : 2,
      },
    }),
    [pointerProfile.isCoarsePointer, dragBoostEnabled]
  );

  const touchSensorOptions = useMemo(() => {
    const base = pointerProfile.isTouchOnly
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
  }, [pointerProfile.isTouchOnly, dragBoostEnabled]);

  const sensors = useSensors(
    useSensor(MouseSensor, mouseSensorOptions),
    useSensor(TouchSensor, touchSensorOptions),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const processDragMoveFrame = useCallback(
    (event: DragMoveEvent) => {
      if (resolveMode !== "sort-submit" || roomStatus !== "clue") {
        return;
      }

      const { over, active } = event;
      const activeRect = active.rect.current.translated ?? active.rect.current.initial ?? null;
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

      const projectedState = pendingMagnetStateRef.current ?? magnetStateRef.current;
      const magnetResult = computeMagnetTransform(over.rect, activeRect, {
        ...magnetConfigRef.current,
        projectedOffset: {
          dx: projectedState.dx,
          dy: projectedState.dy,
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
    [enqueueMagnetUpdate, releaseMagnet, resolveMode, roomStatus, scheduleMagnetTarget]
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

  const magnetAwareDragMove = useCallback(
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

  const computeMagnetSnap = useCallback(
    (
      overRect: Parameters<typeof computeMagnetTransform>[0],
      activeRect: Parameters<typeof computeMagnetTransform>[1]
    ) => {
      return computeMagnetTransform(overRect, activeRect, {
        ...magnetConfigRef.current,
        projectedOffset: {
          dx: magnetStateRef.current.dx,
          dy: magnetStateRef.current.dy,
        },
      });
    },
    []
  );

  return {
    magnetState,
    magnetTargetId,
    handleBoardRef,
    magnetAwareDragMove,
    resetMagnet,
    enqueueMagnetUpdate,
    dropAnimation,
    sensors,
    dragBoostEnabled,
    setDragBoostEnabled,
    dragActivationStartRef,
    boardContainerRef,
    lastDragPositionRef,
    computeMagnetSnap,
  };
}
