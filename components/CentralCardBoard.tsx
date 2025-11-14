"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Flex, Spinner, Text, VisuallyHidden } from "@chakra-ui/react";
import {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type Collision,
  type DropAnimation,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { unstable_batchedUpdates } from "react-dom";
import { CardRenderer } from "@/components/ui/CardRenderer";
import { GameResultOverlay } from "@/components/ui/GameResultOverlay";
import { useDropHandler, DROP_OPTIMISTIC_ENABLED, createDropMetricsSession } from "@/components/hooks/useDropHandler";
import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import { useBoardSlots } from "@/components/hooks/useBoardSlots";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import {
  scheduleAddCardToProposalAtPosition,
  scheduleMoveCardInProposalToPosition,
} from "@/lib/game/proposalScheduler";
import { finalizeReveal, removeCardFromProposal } from "@/lib/game/room";
import type { ResolveMode } from "@/lib/game/resolveMode";
import type { PlayerDoc, PlayerSnapshot, RoomDoc } from "@/lib/types";
import { notify } from "@/components/ui/notify";
import { logError, logWarn } from "@/lib/utils/log";
import { setMetric } from "@/lib/utils/metrics";
import {
  FINAL_TWO_BONUS_DELAY,
  FLIP_EVALUATION_DELAY,
  REVEAL_FIRST_DELAY,
  REVEAL_LINGER,
  REVEAL_STEP_DELAY,
  RESULT_INTRO_DELAY,
  RESULT_RECOGNITION_DELAY,
} from "@/lib/ui/motion";
import { computeMagnetTransform, type MagnetResult } from "@/lib/ui/dragMagnet";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
import useReducedMotionPreference from "@/hooks/useReducedMotionPreference";
import { usePointerProfile } from "@/lib/hooks/usePointerProfile";
import {
  InteractiveBoard,
  StaticBoard,
  RETURN_DROP_ZONE_ID,
  createInitialMagnetState,
  MAGNET_IDLE_MARGIN_PX,
  usePlayerPresenceState,
  useRevealStatus,
  useResultFlipState,
} from "@/components/central-board";
import type { MagnetSnapshot } from "@/components/central-board";

interface CentralCardBoardProps {
  roomId: string;
  players: (PlayerDoc & { id: string })[];
  orderList: string[];
  meId: string;
  eligibleIds: string[];
  roomStatus: RoomDoc["status"];
  cluesReady?: boolean;
  failed: boolean;
  proposal?: (string | null)[];
  resolveMode?: ResolveMode | null;
  orderNumbers?: Record<string, number | null | undefined>;
  orderSnapshots?: Record<string, PlayerSnapshot> | null;
  displayMode?: "full" | "minimal";
  slotCount?: number;
  topic?: string | null;
  revealedAt?: unknown;
  uiRevealPending?: boolean;
  dealPlayers?: string[] | null;
  onOptimisticProposalChange?: (playerId: string, state: "placed" | "removed" | null) => void;
}

const shallowArrayEqual = (
  a: readonly (string | null)[],
  b: readonly (string | null)[]
) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const boardCollisionDetection: CollisionDetection = (args) => {
  const directHits = pointerWithin(args);
  if (directHits.length) return directHits;

  const intersections = rectIntersection(args);
  if (intersections.length) {
    return intersections;
  }

  const { collisionRect, droppableRects, pointerCoordinates } = args;
  if (!collisionRect) return [];

  const dragCenter = {
    x: collisionRect.left + collisionRect.width / 2,
    y: collisionRect.top + collisionRect.height / 2,
  };

  const candidates: { id: UniqueIdentifier; value: number }[] = [];
  droppableRects.forEach((rect, id) => {
    const dropCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const dx = dragCenter.x - dropCenter.x;
    const dy = dragCenter.y - dropCenter.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const axisAllowanceX = Math.max(rect.width * 0.45, 36);
    const axisAllowanceY = Math.max(rect.height * 0.4, 42);
    if (absDx > axisAllowanceX || absDy > axisAllowanceY) {
      return;
    }

    const radialAllowance = Math.max(Math.min(rect.width, rect.height) * 0.55, 52);
    const distance = Math.hypot(dx, dy);
    if (distance > radialAllowance) {
      return;
    }

    candidates.push({ id, value: distance });
  });

  if (candidates.length) {
    candidates.sort((a, b) => a.value - b.value);
    const best = candidates[0];
    const collision: Collision = { id: best.id, data: { value: best.value } };
    return [collision];
  }

  if (!pointerCoordinates) {
    return closestCenter(args);
  }

  return [];
};




const CentralCardBoard: React.FC<CentralCardBoardProps> = ({
  roomId,
  players,
  orderList,
  meId,
  eligibleIds,
  roomStatus,
  failed,
  proposal,
  resolveMode = "sort-submit",
  orderNumbers = {},
  orderSnapshots = null,
  displayMode = "full",
  slotCount,
  revealedAt,
  uiRevealPending = false,
  dealPlayers = null,
  onOptimisticProposalChange,
}) => {
  const { isRevealing, localRevealPending } = useRevealStatus(roomId, roomStatus, uiRevealPending ?? false);

  const {
    playerMap,
    eligibleIdSet,
    me,
    hasNumber,
    mePlaced,
    availableEligibleCount,
    dealReadyForMe,
    dealGuardActive,
  } = usePlayerPresenceState({
    players,
    orderList,
    proposal,
    orderSnapshots,
    eligibleIds,
    meId,
    roomStatus,
    dealPlayers,
  });

  const orderListKey = useMemo(
    () => (Array.isArray(orderList) ? orderList.join(",") : ""),
    [orderList]
  );
  const proposalKey = useMemo(
    () => (Array.isArray(proposal) ? proposal.join(",") : ""),
    [proposal]
  );
  const orderListLength = Array.isArray(orderList) ? orderList.length : 0;

  const [activeId, setActiveId] = useState<string | null>(null);
  const [optimisticReturningIds, setOptimisticReturningIds] = useState<string[]>([]);
  const prefersReducedMotion = useReducedMotionPreference();

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
  const magnetResetTimeoutRef = useRef<number | null>(null);

  const pointerProfile = usePointerProfile();

  const magnetConfig = useMemo(
    () => {
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
    },
    [
      prefersReducedMotion,
      pointerProfile.isCoarsePointer,
      pointerProfile.isTouchOnly,
    ]
  );
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

  const queueMagnetReset = useCallback(
    (delayMs: number) => {
      if (typeof window !== "undefined" && magnetResetTimeoutRef.current !== null) {
        window.clearTimeout(magnetResetTimeoutRef.current);
        magnetResetTimeoutRef.current = null;
      }
      if (delayMs <= 0 || typeof window === "undefined") {
        resetMagnet({ immediate: true });
        return;
      }
      magnetResetTimeoutRef.current = window.setTimeout(() => {
        magnetResetTimeoutRef.current = null;
        resetMagnet({ immediate: true });
      }, delayMs);
    },
    [resetMagnet]
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

      const wasIdle = projected === null;
      const delay = nextId === null || wasIdle ? 0 : prefersReducedMotion ? 36 : 90;
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
      if (typeof window !== "undefined" && magnetResetTimeoutRef.current !== null) {
        window.clearTimeout(magnetResetTimeoutRef.current);
        magnetResetTimeoutRef.current = null;
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

  useEffect(() => {
    setMetric("drag", "boostEnabled", dragBoostEnabled ? 1 : 0);
  }, [dragBoostEnabled]);

  const { pending, setPending, isOver, setIsOver, canDrop, onDropAtPosition, canDropAtPosition } =
    useDropHandler({
      roomId,
      meId,
      me,
      roomStatus,
      orderList,
      proposal,
      hasNumber,
      mePlaced,
      dealReady: dealReadyForMe,
    });

  const updatePendingState = useCallback(
    (updater: (prev: (string | null)[]) => (string | null)[]) => {
      setPending((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        return shallowArrayEqual(prev, next) ? prev : next;
      });
    },
    [setPending]
  );

  const playerReadyMap = useMemo(() => {
    const map = new Map<string, boolean>();
    playerMap.forEach((player, id) => {
      const clue = typeof player?.clue1 === "string" ? player.clue1.trim() : "";
      map.set(id, clue.length > 0);
    });
    return map;
  }, [playerMap]);

  const playDropInvalid = useSoundEffect(undefined);
  const playCardPlace = useSoundEffect("card_place");
  const playDragPickup = useSoundEffect(undefined);

  const { revealAnimating, revealIndex, realtimeResult, finalizeScheduled } = useRevealAnimation({
    roomId,
    roomStatus,
    resolveMode: resolveMode ?? undefined,
    orderListLength,
    orderData:
      orderList && orderNumbers
        ? {
            list: orderList,
            numbers: orderNumbers,
          }
        : null,
    startPending: uiRevealPending || localRevealPending,
  });

  useEffect(() => {
    const onCardReturning = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string; playerId?: string }>).detail;
      if (!detail || detail.roomId !== roomId || !detail.playerId) return;
      const playerId = detail.playerId;
      setOptimisticReturningIds((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]));
    };
    window.addEventListener("ito:card-returning", onCardReturning as EventListener);
    return () => {
      window.removeEventListener("ito:card-returning", onCardReturning as EventListener);
    };
  }, [roomId]);

  useEffect(() => {
    if (!optimisticReturningIds.length) return;
    if (!proposal || proposal.length === 0) {
      setOptimisticReturningIds([]);
      return;
    }
    const proposalSet = new Set(
      (proposal as (string | null)[]).filter((id): id is string => typeof id === "string" && id.length > 0)
    );
    setOptimisticReturningIds((prev) => prev.filter((id) => proposalSet.has(id)));
  }, [proposal, proposalKey, optimisticReturningIds.length]);

  useEffect(() => {
    if (roomStatus !== "clue") {
      setOptimisticReturningIds([]);
    }
  }, [roomStatus]);

  const { resultFlipMap, handleResultCardFlip } = useResultFlipState(roomStatus, orderList);

  const returnCardToWaiting = useCallback(
    async (playerId: string) => {
      window.dispatchEvent(
        new CustomEvent("ito:card-returning", {
          detail: { roomId, playerId },
        })
      );
      updatePendingState((prev) => prev.filter((id) => id !== playerId));
      try {
        await removeCardFromProposal(roomId, playerId);
        playCardPlace();
        notify({ title: "カードを戻しました", type: "info", duration: 900 });
      } catch (error) {
        logError("central-card-board", "remove-card-from-proposal", error);
        playDropInvalid();
        notify({ title: "カードを戻せませんでした", type: "error", duration: 1200 });
      }
    },
    [roomId, updatePendingState, playCardPlace, playDropInvalid]
  );

  const finishedToastRef = useRef(false);
  useEffect(() => {
    if (roomStatus === "finished") {
      if (!finishedToastRef.current) {
        finishedToastRef.current = true;
        const failedAt = realtimeResult?.failedAt ?? null;
        if (typeof failedAt === "number") {
          notify({ id: `${roomId}-game-result`, title: "失敗！", type: "error", duration: 2000 });
        } else {
          notify({ id: `${roomId}-game-result`, title: "勝利！", type: "success", duration: 2000 });
        }
      }
    } else {
      finishedToastRef.current = false;
    }
  }, [roomStatus, realtimeResult?.failedAt, roomId]);

  const orderListSet = useMemo(() => {
    if (!orderListKey && (!orderList || orderList.length === 0)) {
      return new Set<string>();
    }
    return new Set(orderList || []);
  }, [orderList, orderListKey]);

  useEffect(() => {
    if (!orderList || orderList.length === 0) return;
    updatePendingState((cur) =>
      cur.filter((id) => {
        if (typeof id !== "string") return false;
        return !orderListSet.has(id);
      })
    );
  }, [orderList, orderListKey, orderListSet, updatePendingState]);

  useEffect(() => {
    if (!proposal || proposal.length === 0) return;
    const present = new Set((proposal as (string | null)[]).filter(Boolean) as string[]);
    updatePendingState((cur) =>
      cur.filter((id) => {
        if (typeof id !== "string") return false;
        return !present.has(id);
      })
    );
  }, [proposal, proposalKey, updatePendingState]);

  useEffect(() => {
    const onVis = () => {
      try {
        if (document.visibilityState === "hidden") {
          updatePendingState((cur) => (cur.length === 0 ? cur : []));
        }
      } catch {}
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
    };
  }, [updatePendingState]);

  const renderCard = useCallback(
    (id: string, idx?: number) => {
      const interactiveFlip =
        roomStatus === "finished"
          ? {
              flipped: resultFlipMap[id] ?? true,
              onToggle: () => handleResultCardFlip(id),
              preset: "result" as const,
            }
          : undefined;

      return (
        <CardRenderer
          key={id}
          id={id}
          player={playerMap.get(id)}
          idx={idx}
          orderList={orderList}
          pending={pending}
          proposal={proposal}
          resolveMode={resolveMode}
          roomStatus={roomStatus}
          revealIndex={revealIndex}
          revealAnimating={revealAnimating}
          failed={failed}
          realtimeResult={realtimeResult}
          interactiveFlip={interactiveFlip}
        />
      );
    },
    [
      roomStatus,
      resultFlipMap,
      handleResultCardFlip,
      playerMap,
      orderList,
      pending,
      proposal,
      resolveMode,
      revealIndex,
      revealAnimating,
      failed,
      realtimeResult,
    ]
  );

  /* selectors */ const activeProposal = useMemo<(string | null)[]>(() => {
    if (!orderListKey && !proposalKey) {
      return [];
    }

    const normalizedOrder = (orderList || []).map((id) =>
      typeof id === "string" && id.length > 0 ? id : null
    );

    // reveal/finished は履歴どおり表示（localHide では切り替えない）
    if (roomStatus === "finished" || roomStatus === "reveal") {
      return normalizedOrder;
    }

    // 進行中は在室メンバーのみ反映（スロット位置を保持）
    if (Array.isArray(proposal)) {
      const sanitized = proposal.map((id) =>
        typeof id === "string" && id.length > 0 && eligibleIdSet.has(id) ? id : null
      );
      if (sanitized.some(Boolean)) return sanitized;
    }

    // リビール直前のフォロー（在室メンバーに限定）
    if (normalizedOrder.some(Boolean)) {
      const filteredOrder = normalizedOrder.filter(
        (id): id is string => typeof id === "string" && id.length > 0 && eligibleIdSet.has(id)
      );
      if (filteredOrder.length > 0) return filteredOrder;
    }

    return [];
  }, [roomStatus, orderList, proposal, orderListKey, proposalKey, eligibleIdSet]);

  const proposalLength = activeProposal.length;

  const slotCountDragging = useMemo(() => {
    if (typeof slotCount === "number" && slotCount > 0) return slotCount;
    return Math.max(proposalLength, availableEligibleCount);
  }, [slotCount, proposalLength, availableEligibleCount]);

  const slotCountStatic = useMemo(() => {
    if (typeof slotCount === "number" && slotCount > 0) return slotCount;
    if (roomStatus === "reveal" || roomStatus === "finished") {
      return orderListLength;
    }
    return Math.max(proposalLength, availableEligibleCount);
  }, [slotCount, roomStatus, orderListLength, proposalLength, availableEligibleCount]);

  const isGameActive = useMemo(
    () => roomStatus === "clue" || roomStatus === "reveal" || roomStatus === "finished",
    [roomStatus]
  );

  const { dragSlots, staticSlots, waitingPlayers } = useBoardSlots({
    slotCountDragging,
    slotCountStatic,
    activeProposal,
    pending,
    playerReadyMap,
    optimisticReturningIds,
    isGameActive,
    roomStatus,
    orderList,
    canDropAtPosition,
    eligibleIds,
    eligibleIdSet,
    playerMap,
    activeId,
  });

  const magnetSnapshot = useMemo<MagnetSnapshot>(
    () => ({ targetId: magnetTargetId, strength: magnetState.strength }),
    [magnetTargetId, magnetState.strength]
  );

  const handleSlotEnter = useCallback(
    (_index: number) => {
      if (!isOver) {
        setIsOver(true);
      }
    },
    [isOver, setIsOver]
  );

  const handleSlotLeave = useCallback(() => {
    setIsOver(false);
  }, [setIsOver]);

  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const clearPendingTimer = () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };

    if (
      resolveMode === "sort-submit" &&
      roomStatus === "reveal" &&
      orderListLength > 0 &&
      !finalizeScheduled
    ) {
      const revealTraversal =
        REVEAL_FIRST_DELAY + Math.max(0, orderListLength - 1) * REVEAL_STEP_DELAY;
      const extraFlipPad =
        FLIP_EVALUATION_DELAY + (orderListLength > 1 ? FINAL_TWO_BONUS_DELAY : 0);
      const finalizeDelay =
        REVEAL_LINGER + extraFlipPad + RESULT_INTRO_DELAY + RESULT_RECOGNITION_DELAY;
      const SAFETY_BUFFER_MS = 600;
      const total = revealTraversal + finalizeDelay + SAFETY_BUFFER_MS;
      clearPendingTimer();
      fallbackTimerRef.current = setTimeout(() => {
        finalizeReveal(roomId).catch(() => void 0);
      }, total);
      return clearPendingTimer;
    }

    clearPendingTimer();
    return clearPendingTimer;
  }, [roomStatus, resolveMode, orderListLength, roomId, finalizeScheduled]);

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
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
    },
    [resetMagnet, playDragPickup]
  );

  const clearActive = useCallback(
    (options?: { delayMagnetReset?: boolean }) => {
      unstable_batchedUpdates(() => {
        setIsOver(false);
        setActiveId(null);
      });
      const shouldDelay = options?.delayMagnetReset ?? false;
      if (!shouldDelay) {
        queueMagnetReset(0);
        return;
      }
      const baseDelay = prefersReducedMotion
        ? 130
        : magnetStateRef.current.shouldSnap
          ? 220
          : 260;
      queueMagnetReset(baseDelay);
    },
    [prefersReducedMotion, queueMagnetReset, setIsOver]
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const activeRect = active.rect.current.translated ?? active.rect.current.initial ?? null;
      if (activeRect) {
        lastDragPositionRef.current = {
          x: activeRect.left + activeRect.width / 2,
          y: activeRect.top + activeRect.height / 2,
        };
      }
      const overRect = over?.rect ?? null;
      let magnetResult = createInitialMagnetState();

      try {
        if (resolveMode !== "sort-submit" || roomStatus !== "clue") return;

        const activePlayerId = String(active.id);
        const alreadyInProposal = (activeProposal as (string | null)[]).includes(activePlayerId);
        const isSlotTarget = over && typeof over.id === "string" && over.id.startsWith("slot-");
        const isReturnTarget = over && typeof over.id === "string" && over.id === RETURN_DROP_ZONE_ID;

        const boardRect = boardContainerRef.current?.getBoundingClientRect();
        const lastPosition = lastDragPositionRef.current;
        const fallbackReturn =
          !isReturnTarget &&
          !isSlotTarget &&
          alreadyInProposal &&
          boardRect &&
          lastPosition &&
          lastPosition.y >= boardRect.bottom + 6 &&
          lastPosition.x >= boardRect.left - 16 &&
          lastPosition.x <= boardRect.right + 16;
        const initiateReturn = () => {
          onOptimisticProposalChange?.(activePlayerId, "removed");
          returnCardToWaiting(activePlayerId).catch((error) => {
            onOptimisticProposalChange?.(activePlayerId, null);
            logError("central-card-board", "return-card-to-waiting", error);
            playDropInvalid();
            const message =
              error instanceof Error
                ? error.message
                : error !== null && error !== undefined
                  ? String(error)
                  : "";
            notify({
              title: "カードを戻せませんでした",
              description: message || undefined,
              type: "error",
            });
          });
        };

        if (isReturnTarget || fallbackReturn) {
          if (!alreadyInProposal) {
            playDropInvalid();
            return;
          }
          if (activePlayerId !== meId) {
            playDropInvalid();
            notify({ title: "自分のカードだけ戻せます", type: "info", duration: 1200 });
            return;
          }
          initiateReturn();
          return;
        }

        if (!over) {
          playDropInvalid();
          notify({ title: "この位置には置けません", type: "info", duration: 900 });
          return;
        }

        if (active.id === over.id) return;

        const overId = String(over.id);

        if (overId === RETURN_DROP_ZONE_ID) {
          if (!alreadyInProposal) {
            playDropInvalid();
            return;
          }
          if (activePlayerId !== meId) {
            playDropInvalid();
            notify({ title: "自分のカードだけ戻せます", type: "info", duration: 1200 });
            return;
          }
          initiateReturn();
          return;
        }

        if (isSlotTarget && overRect) {
          magnetResult = computeMagnetTransform(overRect, activeRect, {
            ...magnetConfigRef.current,
            projectedOffset: {
              dx: magnetStateRef.current.dx,
              dy: magnetStateRef.current.dy,
            },
          });
          let slotIndex = parseInt(overId.split("-")[1], 10);
          if (!Number.isNaN(slotIndex)) {
            const maxSlots = Math.max(0, slotCountDragging - 1);
            const originalSlotIndex = slotIndex;
            slotIndex = Math.min(Math.max(0, slotIndex), maxSlots);

            if (process.env.NODE_ENV === "development" && originalSlotIndex !== slotIndex) {
              logWarn("central-card-board", "slot-index-clamped", {
                originalSlotIndex,
                slotIndex,
                maxSlots,
                slotCountDragging,
              });
            }

            let dropSession: ReturnType<typeof createDropMetricsSession> | null = null;
            let previousPending: (string | null)[] | undefined;
            let insertedPending = false;
            let didPlaySound = false;
            const playOnce = () => {
              if (didPlaySound) return;
              didPlaySound = true;
              playCardPlace();
              dropSession?.markStage("client.drop.t3_soundPlayedMs", { channel: "success" });
            };
            if (!alreadyInProposal) {
              dropSession = createDropMetricsSession({
                optimisticMode: DROP_OPTIMISTIC_ENABLED,
                index: slotIndex,
              });
              onOptimisticProposalChange?.(activePlayerId, "placed");
              updatePendingState((prev) => {
                previousPending = prev.slice();
                const next = [...prev];
                const exist = next.indexOf(activePlayerId);
                if (exist >= 0) next.splice(exist, 1);
                if (slotIndex >= next.length) {
                  next.length = slotIndex + 1;
                }
                next[slotIndex] = activePlayerId;
                insertedPending = true;
                return next;
              });
            }

            if (alreadyInProposal) {
              playOnce();
              scheduleMoveCardInProposalToPosition(roomId, activePlayerId, slotIndex).catch((error) => {
                logError("central-card-board", "move-card-in-proposal", error);
                playDropInvalid();
              });
              return;
            }

            const request = scheduleAddCardToProposalAtPosition(roomId, activePlayerId, slotIndex);
            if (insertedPending) {
              playOnce();
            }
            request
              .then((result) => {
                dropSession?.markStage("client.drop.t2_addProposalResolvedMs", { result });
                if (result === "noop") {
                  dropSession?.complete("noop");
                  onOptimisticProposalChange?.(activePlayerId, null);
                  if (previousPending !== undefined) {
                    const snapshot = previousPending.slice();
                    updatePendingState(() => snapshot);
                  }
                  notify({
                    title: "その位置には置けません",
                    description: "カードが既に置かれているか、提案が更新されています。",
                    type: "info",
                  });
                  playDropInvalid();
                  dropSession?.markStage("client.drop.t1_notifyShownMs", { origin: "post" });
                  return;
                }
                playOnce();
                dropSession?.complete("success");
              })
              .catch((error) => {
                dropSession?.markStage("client.drop.t2_addProposalResolvedMs", { result: "error" });
                dropSession?.complete("error");
                logError("central-card-board", "add-card-to-proposal", error);
                onOptimisticProposalChange?.(activePlayerId, null);
                if (previousPending !== undefined) {
                  const snapshot = previousPending.slice();
                  updatePendingState(() => snapshot);
                }
                playDropInvalid();
                dropSession?.markStage("client.drop.t1_notifyShownMs", { origin: "error" });
              });
            return;
          }
          return;
        }

        if (alreadyInProposal) {
          const targetIndex = (activeProposal as (string | null)[]).indexOf(overId);
          if (targetIndex < 0) {
            playDropInvalid();
            return;
          }
          playCardPlace();
          scheduleMoveCardInProposalToPosition(roomId, activePlayerId, targetIndex).catch((error) => {
            logError("central-card-board", "move-card-in-proposal", error);
            playDropInvalid();
          });
        }
      } finally {
        enqueueMagnetUpdate({ state: magnetResult, immediate: true });
        clearActive({ delayMagnetReset: true });
      }
    },
    [
      enqueueMagnetUpdate,
      resolveMode,
      roomStatus,
      playDropInvalid,
      playCardPlace,
      returnCardToWaiting,
      activeProposal,
      meId,
      updatePendingState,
      roomId,
      slotCountDragging,
      clearActive,
    ]
  );

  const onDragCancel = useCallback(() => {
    dragActivationStartRef.current = null;
    clearActive();
  }, [clearActive]);

  const activeBoard = resolveMode === "sort-submit" && roomStatus === "clue";

  return (
    <Box
      data-board-root
      h="100%"
      display="flex"
      flexDirection="column"
      border="none"
      borderWidth="0"
      css={{
        background: "transparent",
        position: "relative",
        "@media (pointer: coarse)": {
          touchAction: "none",
          WebkitTouchCallout: "none",
          userSelect: "none",
          overscrollBehavior: "contain",
        },
      }}
    >
      <VisuallyHidden aria-live="polite">
        {isRevealing
          ? `進行状況: ${revealIndex} / ${(orderList || []).length}`
          : roomStatus === "finished"
          ? realtimeResult?.failedAt !== null && realtimeResult?.failedAt !== undefined
            ? `結果: ${realtimeResult.failedAt}番目で失敗`
            : "結果: 成功"
          : ""}
      </VisuallyHidden>

      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="flex-start"
        overflow="visible"
        position="relative"
        minHeight={0}
        pt={{ base: "8vh", md: "10vh" }}
        pb={{ base: 2, md: 3 }}
        css={{
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            paddingTop: "9vh !important",
            paddingBottom: "0.75rem !important",
          },
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
            paddingTop: "10vh !important",
            paddingBottom: "0.5rem !important",
          },
        }}
      >
        {dealGuardActive ? (
          <Flex
            direction="column"
            align="center"
            gap="0.35rem"
            px="1rem"
            py="0.75rem"
            borderRadius="md"
            bg="rgba(6, 22, 42, 0.82)"
            border="1px solid rgba(255, 255, 255, 0.18)"
            boxShadow="0 12px 28px rgba(0, 0, 0, 0.45)"
            backdropFilter="blur(4px)"
            pointerEvents="none"
            position="absolute"
            top={{ base: "1rem", md: "1.5rem" }}
            left="50%"
            transform="translateX(-50%)"
            zIndex={2}
            maxW="min(92%, 480px)"
            textAlign="center"
          >
            <Flex align="center" gap="0.6rem">
              <Spinner size="sm" color="whiteAlpha.900" />
              <Text fontSize="sm" fontWeight={700} color="whiteAlpha.900">
                配札を待っています…
              </Text>
            </Flex>
            <Text fontSize="xs" color="whiteAlpha.700">
              数字の配布が完了するとカードを動かせます
            </Text>
          </Flex>
        ) : null}
        {activeBoard ? (
          <InteractiveBoard
            slots={dragSlots}
            magnetSnapshot={magnetSnapshot}
            magnetState={magnetState}
            prefersReducedMotion={prefersReducedMotion}
            activeId={activeId}
            isOver={isOver}
            canDrop={canDrop}
            sensors={sensors}
            collisionDetection={boardCollisionDetection}
            onDragStart={onDragStart}
            onDragMove={magnetAwareDragMove}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
            dropAnimation={dropAnimation}
            renderCard={renderCard}
            activeProposal={activeProposal}
            waitingPlayers={waitingPlayers}
            meId={meId}
            displayMode={displayMode}
            roomStatus={roomStatus}
            boardRef={handleBoardRef}
            isRevealing={isRevealing}
          />
        ) : (
          <StaticBoard
            slots={staticSlots}
            renderCard={renderCard}
            isOver={isOver}
            canDrop={canDrop}
            roomStatus={roomStatus}
            waitingPlayers={waitingPlayers}
            meId={meId}
            displayMode={displayMode}
            onDropAtPosition={onDropAtPosition}
            onSlotEnter={handleSlotEnter}
            onSlotLeave={handleSlotLeave}
            isRevealing={isRevealing}
          />
        )}
      </Box>
      {roomStatus === "finished" && (
        <GameResultOverlay failed={failed} mode="overlay" revealedAt={revealedAt} />
      )}
    </Box>
  );
};

export default CentralCardBoard;
