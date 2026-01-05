"use client";

import {
  InteractiveBoard,
  MAGNET_IDLE_MARGIN_PX,
  RETURN_DROP_ZONE_ID,
  StaticBoard,
  createInitialMagnetState,
  usePlayerPresenceState,
  useResultFlipState,
  useRevealStatus,
} from "@/components/central-board";
import {
  buildOptimisticProposalSnapshot,
  buildOptimisticStateKey,
  buildProposalSignature,
  buildRenderedProposalForSignature,
  sanitizeOptimisticProposal,
} from "@/components/central-board/optimisticReorder";
import {
  buildPlaceholderSlots,
  computeSlotCountTarget,
  countActiveProposalIds,
  isGameActiveStatus,
} from "@/components/central-board/boardDerivations";
import { useBoardBoundsTracker } from "@/components/central-board/useBoardBoundsTracker";
import { useBoardDebugDump } from "@/components/central-board/useBoardDebugDump";
import { useActiveDragCancelFallback } from "@/components/central-board/useActiveDragCancelFallback";
import { useOptimisticReturningIds } from "@/components/central-board/useOptimisticReturningIds";
import { usePendingPruneEffects } from "@/components/central-board/usePendingPruneEffects";
import { usePlaceholderSlotTrace } from "@/components/central-board/usePlaceholderSlotTrace";
import { useRevealDoneFallback } from "@/components/central-board/useRevealDoneFallback";
import { useResolvedSlotCount } from "@/components/central-board/useResolvedSlotCount";
import { useBoardSlots } from "@/components/hooks/useBoardSlots";
import {
  DROP_OPTIMISTIC_ENABLED,
  createDropMetricsSession,
  useDropHandler,
} from "@/components/hooks/useDropHandler";
import { useMagnetController } from "@/components/hooks/useMagnetController";
import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import { CardRenderer } from "@/components/ui/CardRenderer";
import { notify } from "@/components/ui/notify";
import useReducedMotionPreference from "@/hooks/useReducedMotionPreference";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import {
  STREAK_BANNER_AUTOHIDE_MS,
  STREAK_BANNER_AUTOHIDE_REDUCED_MS,
  STREAK_BANNER_DELAY_MS,
} from "@/lib/constants/uiTimings";
import {
  scheduleAddCardToProposalAtPosition,
  scheduleMoveCardInProposalToPosition,
} from "@/lib/game/proposalScheduler";
import type { ResolveMode } from "@/lib/game/resolveMode";
import { computeBoardActiveProposal } from "@/lib/game/selectors";
import { usePointerProfile } from "@/lib/hooks/usePointerProfile";
import type { RoomMachineClientEvent } from "@/lib/state/roomMachine";
import type { PlayerDoc, PlayerSnapshot, RoomDoc } from "@/lib/types";
import { computeMagnetTransform, type RectLike } from "@/lib/ui/dragMagnet";
import {
  FLIP_DURATION_MS,
  RESULT_INTRO_DELAY,
} from "@/lib/ui/motion";
import { logError, logWarn } from "@/lib/utils/log";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";
import { UI_TOKENS, UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, VisuallyHidden } from "@chakra-ui/react";
import {
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type Collision,
  type CollisionDetection,
  type DropAnimation,
  type DropAnimationKeyframeResolver,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS, getEventCoordinates } from "@dnd-kit/utilities";
import dynamic from "next/dynamic";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { unstable_batchedUpdates } from "react-dom";

const GameResultOverlay = dynamic(
  () =>
    import("@/components/ui/GameResultOverlay").then(
      (mod) => mod.GameResultOverlay
    ),
  { loading: () => null, ssr: false }
);

const StreakBanner = dynamic(
  () => import("@/components/ui/StreakBanner").then((mod) => mod.StreakBanner),
  { loading: () => null }
);

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
  currentStreak?: number;
  onOptimisticProposalChange?: (
    playerId: string,
    state: "placed" | "removed" | null
  ) => void;
  sendRoomEvent?: (event: RoomMachineClientEvent) => void;
  presenceReady?: boolean;
  interactionEnabled?: boolean;
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

const snapshotRect = (rect: RectLike): RectLike => ({
  left: rect.left,
  top: rect.top,
  width: rect.width,
  height: rect.height,
});

const translateRect = (
  rect: RectLike,
  delta: { x: number; y: number }
): RectLike => ({
  left: rect.left + delta.x,
  top: rect.top + delta.y,
  width: rect.width,
  height: rect.height,
});

const getActiveRectWithDelta = (
  active: DragMoveEvent["active"] | DragEndEvent["active"],
  delta?: { x: number; y: number }
): RectLike | null => {
  const translated = active.rect.current.translated;
  if (translated) {
    return translated as RectLike;
  }
  const initial = active.rect.current.initial;
  if (!initial) return null;
  if (delta && (delta.x !== 0 || delta.y !== 0)) {
    return translateRect(initial as RectLike, delta);
  }
  return initial as RectLike;
};

const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length) {
    return pointerHits;
  }

  const { droppableRects, pointerCoordinates } = args;
  if (pointerCoordinates) {
    const candidates: { id: UniqueIdentifier; value: number }[] = [];
    droppableRects.forEach((rect, id) => {
      const dropCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      const dx = pointerCoordinates.x - dropCenter.x;
      const dy = pointerCoordinates.y - dropCenter.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      const axisAllowanceX = Math.max(rect.width * 0.45, 36);
      const axisAllowanceY = Math.max(rect.height * 0.4, 42);
      if (absDx > axisAllowanceX || absDy > axisAllowanceY) {
        return;
      }

      const radialAllowance = Math.max(
        Math.min(rect.width, rect.height) * 0.55,
        52
      );
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

    // マウス/タッチ位置が存在し、近接候補も無い場合は「未ヒット」とみなす
    // （1人部屋で唯一のスロットが常に選ばれる暴走を防止）
    return [];
  }

  // キーボード操作など pointerCoordinates が無い場合のみフォールバック
  return closestCenter(args);
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
  currentStreak = 0,
  onOptimisticProposalChange,
  sendRoomEvent,
  presenceReady = true,
  interactionEnabled = true,
}) => {
  const { isRevealing, localRevealPending } = useRevealStatus(
    roomId,
    roomStatus,
    uiRevealPending ?? false
  );

  // 勝利演出の Pixi モジュールを先読みして、初回から Pixi 版を使えるようにする
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_PIXI_RAYS === "0") return;
    void import("@/lib/pixi/victoryRays").catch((error) => {
      console.warn("[CentralCardBoard] prefetch victory rays failed", error);
    });
  }, []);

  // Streak Banner の表示管理
  const [showStreakBanner, setShowStreakBanner] = useState(false);

  const {
    playerMap,
    missingPlayerIds,
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
  const [optimisticReturningIds, setOptimisticReturningIds] = useState<
    string[]
  >([]);
  const prefersReducedMotion = useReducedMotionPreference();

  const pointerProfile = usePointerProfile();
  const dropDebugEnabled = process.env.NEXT_PUBLIC_UI_DROP_DEBUG === "1";

  // Streak Banner のタイミング制御
  const streakTimerRef = useRef<number | null>(null);
  const streakAutoHideRef = useRef<number | null>(null);

  useEffect(() => {
    if (roomStatus === "finished" && !failed && currentStreak >= 2) {
      // GameResultOverlay のアニメーション完了を待つ
      // 勝利アニメーションは約2.5秒、0.3秒の間を置いて表示（タイミング短縮）
      streakTimerRef.current = window.setTimeout(() => {
        setShowStreakBanner(true);
      }, STREAK_BANNER_DELAY_MS);

      return () => {
        if (streakTimerRef.current) {
          clearTimeout(streakTimerRef.current);
          streakTimerRef.current = null;
        }
        if (streakAutoHideRef.current) {
          clearTimeout(streakAutoHideRef.current);
          streakAutoHideRef.current = null;
        }
      };
    } else if (roomStatus !== "finished") {
      // 次のゲームが始まったらバナーを閉じる
      setShowStreakBanner(false);
    }

    return undefined;
  }, [roomStatus, failed, currentStreak]);

  // バナーが表示されたまま残るのを防ぐフォールバック
  useEffect(() => {
    if (!showStreakBanner) return undefined;
    const duration = prefersReducedMotion
      ? STREAK_BANNER_AUTOHIDE_REDUCED_MS
      : STREAK_BANNER_AUTOHIDE_MS; // アニメーション完了を十分にカバーするバッファ
    streakAutoHideRef.current = window.setTimeout(() => {
      setShowStreakBanner(false);
    }, duration);
    return () => {
      if (streakAutoHideRef.current) {
        clearTimeout(streakAutoHideRef.current);
        streakAutoHideRef.current = null;
      }
    };
  }, [showStreakBanner, prefersReducedMotion]);

  const magnetResetTimeoutRef = useRef<number | null>(null);
  const [cursorSnapOffset, setCursorSnapOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const dropRollbackTimersRef = useRef<Map<string, number>>(new Map());
  const dropRollbackSnapshotsRef = useRef<Map<string, (string | null)[]>>(
    new Map()
  );
  const latestActiveProposalRef = useRef<(string | null)[]>([]);
  const pendingRef = useRef<(string | null)[]>([]);
  const forceResyncTimerRef = useRef<number | null>(null);
  const optimisticSessionRef = useRef(0);

  const magnetConfig = useMemo(() => {
    const isTouchLike =
      pointerProfile.isTouchOnly || pointerProfile.isCoarsePointer;
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
  }, [
    prefersReducedMotion,
    pointerProfile.isCoarsePointer,
    pointerProfile.isTouchOnly,
  ]);
  const magnetController = useMagnetController(magnetConfig, {
    prefersReducedMotion,
  });
  const {
    enqueueMagnetUpdate,
    resetMagnet,
    scheduleMagnetTarget,
    getProjectedMagnetState,
    magnetConfigRef,
  } = magnetController;

  const dropAnimationTargetRef = useRef<RectLike | null>(null);
  const dropAnimationMetaRef = useRef<{ magnetSnap: boolean }>({
    magnetSnap: false,
  });
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

  const {
    boardContainerRef,
    boardBoundsRef,
    dragActivationStartRef,
    handleBoardRef,
    updateBoardBounds,
  } = useBoardBoundsTracker();
  const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);
  const latestDragMoveEventRef = useRef<DragMoveEvent | null>(null);
  const dragMoveRafRef = useRef<number | null>(null);
  const [dragBoostEnabled, setDragBoostEnabled] = useState(false);

  useEffect(() => {
    return () => {
      if (dragMoveRafRef.current !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(dragMoveRafRef.current);
        dragMoveRafRef.current = null;
      }
      latestDragMoveEventRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (roomStatus !== "clue" && dragBoostEnabled) {
      setDragBoostEnabled(false);
      dragActivationStartRef.current = null;
    }
  }, [roomStatus, dragBoostEnabled]);

  const queueMagnetReset = useCallback(
    (delayMs: number) => {
      if (
        typeof window !== "undefined" &&
        magnetResetTimeoutRef.current !== null
      ) {
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

  useEffect(() => {
    const timersRef = dropRollbackTimersRef;
    const snapshotsRef = dropRollbackSnapshotsRef;
    return () => {
      if (
        typeof window !== "undefined" &&
        magnetResetTimeoutRef.current !== null
      ) {
        window.clearTimeout(magnetResetTimeoutRef.current);
        magnetResetTimeoutRef.current = null;
      }
      if (
        typeof window !== "undefined" &&
        forceResyncTimerRef.current !== null
      ) {
        window.clearTimeout(forceResyncTimerRef.current);
        forceResyncTimerRef.current = null;
      }
      if (typeof window !== "undefined" && timersRef.current.size > 0) {
        timersRef.current.forEach((timer) => window.clearTimeout(timer));
        timersRef.current.clear();
      }
      snapshotsRef.current.clear();
    };
  }, []);

  const releaseMagnet = useCallback(() => {
    scheduleMagnetTarget(null);
    const projectedState = getProjectedMagnetState();
    if (
      projectedState.dx !== 0 ||
      projectedState.dy !== 0 ||
      projectedState.strength > 0 ||
      projectedState.shouldSnap
    ) {
      enqueueMagnetUpdate({ state: createInitialMagnetState() });
    }
  }, [enqueueMagnetUpdate, getProjectedMagnetState, scheduleMagnetTarget]);

  const resolveDropAnimationKeyframes =
    useCallback<DropAnimationKeyframeResolver>(
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

  const mouseSensorOptions = useMemo(
    () => ({
      activationConstraint: {
        // Avoid accidental micro-drags on desktop (which can momentarily hide the card)
        // while keeping touch devices responsive.
        distance: (() => {
          const base = pointerProfile.isCoarsePointer ? 6 : 4;
          // "Boost" keeps activation snappy but should not be hair-trigger.
          return dragBoostEnabled ? Math.max(2, Math.round(base * 0.5)) : base;
        })(),
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

      if (
        !over ||
        typeof over.id !== "string" ||
        !over.id.startsWith("slot-")
      ) {
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
      enqueueMagnetUpdate,
      getProjectedMagnetState,
      magnetConfigRef,
      releaseMagnet,
      resolveMode,
      roomStatus,
      scheduleMagnetTarget,
      cursorSnapOffset,
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
      dragMoveRafRef.current =
        window.requestAnimationFrame(flushPendingDragMove);
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

  useEffect(() => {
    setMetric("drag", "boostEnabled", dragBoostEnabled ? 1 : 0);
  }, [dragBoostEnabled]);

  const {
    pending,
    setPending,
    isOver,
    setIsOver,
    canDrop,
    onDropAtPosition,
    canDropAtPosition,
  } = useDropHandler({
    roomId,
    meId,
    me,
    roomStatus,
    orderList,
    proposal,
    hasNumber,
    mePlaced,
    dealReady: dealReadyForMe,
    dealGuardActive,
    interactionEnabled,
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

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const pendingHasContent = useMemo(
    () => pending.some((id) => typeof id === "string" && id.length > 0),
    [pending]
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

  const {
    revealAnimating,
    revealIndex,
    realtimeResult,
    finalizeScheduled,
    resultIntroReadyAt,
  } = useRevealAnimation({
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

  // 結果オーバーレイを表示してよい最短タイミングをローカルで管理（roomStatusが早くfinishedになっても待つ）
  const [resultOverlayAllowed, setResultOverlayAllowed] = useState(false);
  useEffect(() => {
    if (roomStatus !== "finished") {
      setResultOverlayAllowed(false);
      return undefined;
    }
    const now = Date.now();
    // 最低でも「最後のフリップ完了 + RESULT_INTRO_DELAY」ぶん待つ。
    // resultIntroReadyAt が過去でも、ミニマムの余韻（FLIP_DURATION+RESULT_INTRO）を確保する。
    const minimalIntro = now + FLIP_DURATION_MS + RESULT_INTRO_DELAY; // ≈510ms
    const target = Math.max(resultIntroReadyAt ?? 0, minimalIntro);
    const delay = Math.max(0, target - now);
    setResultOverlayAllowed(false);
    const timer = window.setTimeout(() => setResultOverlayAllowed(true), delay);
    return () => window.clearTimeout(timer);
  }, [roomStatus, resultIntroReadyAt]);

  // optimisticReturningIds のタイムアウトクリア用
  const returningTimeoutsRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());

  const { returnCardToWaiting } = useOptimisticReturningIds({
    roomId,
    roomStatus,
    proposal: proposal ?? null,
    proposalKey,
    optimisticReturningIds,
    setOptimisticReturningIds,
    returningTimeoutsRef,
    updatePendingState,
    playCardPlace,
    playDropInvalid,
  });


  const { resultFlipMap, handleResultCardFlip } = useResultFlipState(
    roomStatus,
    orderList
  );

  usePendingPruneEffects({
    orderList,
    orderListKey,
    proposal,
    proposalKey,
    updatePendingState,
  });

  useEffect(() => {
    const onVis = () => {
      try {
        if (document.visibilityState === "hidden") {
          updatePendingState((cur) => (cur.length === 0 ? cur : []));
          // 画面非表示時は楽観状態をすべてリセット
          setOptimisticProposal(null);
          setOptimisticReturningIds([]);
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
    return computeBoardActiveProposal({
      status: roomStatus,
      orderList,
      proposal,
      eligibleIdSet,
      orderListKey,
      proposalKey,
    });
  }, [
    roomStatus,
    orderList,
    proposal,
    orderListKey,
    proposalKey,
    eligibleIdSet,
  ]);

  useEffect(() => {
    latestActiveProposalRef.current = activeProposal;
  }, [activeProposal]);

  const [optimisticProposal, setOptimisticProposal] = useState<
    (string | null)[] | null
  >(null);
  const boardProposal = optimisticProposal ?? activeProposal;

  const renderedProposalForSignature = useMemo<(string | null)[]>(() => {
    return buildRenderedProposalForSignature({
      activeProposal,
      optimisticProposal,
      pending,
      optimisticReturningIds,
    });
  }, [activeProposal, optimisticProposal, pending, optimisticReturningIds]);

  const renderedProposalSignature = useMemo(
    () => buildProposalSignature(renderedProposalForSignature),
    [renderedProposalForSignature]
  );

  const serverProposalSignature = useMemo(
    () => buildProposalSignature(activeProposal),
    [activeProposal]
  );

  const optimisticStateKey = useMemo(() => {
    return buildOptimisticStateKey({
      optimisticProposal,
      pending,
      optimisticReturningIds,
    });
  }, [optimisticProposal, pending, optimisticReturningIds]);

  const hasOptimisticState = useMemo(
    () =>
      Boolean(optimisticProposal) ||
      pendingHasContent ||
      optimisticReturningIds.length > 0,
    [optimisticProposal, pendingHasContent, optimisticReturningIds.length]
  );

  const clearDropRollbackTimer = useCallback((playerId?: string) => {
    if (!playerId) {
      if (typeof window !== "undefined") {
        dropRollbackTimersRef.current.forEach((timer) =>
          window.clearTimeout(timer)
        );
      }
      dropRollbackTimersRef.current.clear();
      dropRollbackSnapshotsRef.current.clear();
      return;
    }
    const timer = dropRollbackTimersRef.current.get(playerId);
    if (typeof window !== "undefined" && typeof timer === "number") {
      window.clearTimeout(timer);
    }
    dropRollbackTimersRef.current.delete(playerId);
    dropRollbackSnapshotsRef.current.delete(playerId);
  }, []);

  const clearForceResyncTimer = useCallback(() => {
    if (forceResyncTimerRef.current) {
      clearTimeout(forceResyncTimerRef.current);
      forceResyncTimerRef.current = null;
    }
  }, []);

  const resetOptimisticState = useCallback(
    (reason: "hash-mismatch" | "forced-sync") => {
      if (
        !optimisticProposal &&
        !pendingHasContent &&
        optimisticReturningIds.length === 0
      ) {
        return;
      }
      clearForceResyncTimer();
      clearDropRollbackTimer();
      dropRollbackSnapshotsRef.current.clear();
      const returningMap = returningTimeoutsRef.current;
      returningMap.forEach((timeout) => clearTimeout(timeout));
      returningMap.clear();
      pendingRef.current = [];
      unstable_batchedUpdates(() => {
        setOptimisticProposal(null);
        setPending(() => []);
        setOptimisticReturningIds([]);
      });
      traceAction("proposal.resync", {
        roomId,
        reason,
        serverSig: serverProposalSignature,
        localSig: renderedProposalSignature,
      });
    },
    [
      clearDropRollbackTimer,
      clearForceResyncTimer,
      optimisticProposal,
      pendingHasContent,
      optimisticReturningIds.length,
      roomId,
      serverProposalSignature,
      renderedProposalSignature,
      setPending,
    ]
  );

  useEffect(() => {
    if (roomStatus === "waiting") {
      resetOptimisticState("forced-sync");
    }
  }, [roomStatus, resetOptimisticState]);

  const applyOptimisticReorder = useCallback(
    (playerId: string, targetIndex: number) => {
      setOptimisticProposal((prev) => {
        const next = buildOptimisticProposalSnapshot(
          prev ?? boardProposal,
          playerId,
          targetIndex
        );
        return next ?? prev ?? null;
      });
    },
    [boardProposal]
  );

  const scheduleDropRollback = useCallback(
    (playerId: string, snapshot: (string | null)[]) => {
      if (typeof window === "undefined") return;
      clearDropRollbackTimer(playerId);
      dropRollbackSnapshotsRef.current.set(playerId, snapshot.slice());
      const timeoutMs = prefersReducedMotion ? 1400 : 1700;
      const handle = window.setTimeout(() => {
        dropRollbackTimersRef.current.delete(playerId);
        const latestServerProposal = latestActiveProposalRef.current;
        if (latestServerProposal.includes(playerId)) {
          dropRollbackSnapshotsRef.current.delete(playerId);
          return;
        }
        const rollback = dropRollbackSnapshotsRef.current.get(playerId);
        dropRollbackSnapshotsRef.current.delete(playerId);
        if (!rollback) return;
        updatePendingState(() => rollback.slice());
        onOptimisticProposalChange?.(playerId, null);
        notify({
          title: "配置を巻き戻しました",
          description:
            "サーバー反映が遅延したためローカル状態をリセットしました。",
          type: "info",
          duration: 1400,
        });
      }, timeoutMs);
      dropRollbackTimersRef.current.set(playerId, handle);
    },
    [
      clearDropRollbackTimer,
      prefersReducedMotion,
      updatePendingState,
      onOptimisticProposalChange,
    ]
  );

  const lastServerSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasOptimisticState) {
      lastServerSignatureRef.current = serverProposalSignature;
      return undefined;
    }
    if (serverProposalSignature === lastServerSignatureRef.current) {
      return undefined;
    }
    lastServerSignatureRef.current = serverProposalSignature;
    if (renderedProposalSignature === serverProposalSignature) {
      return undefined;
    }
    resetOptimisticState("hash-mismatch");
    return undefined;
  }, [
    hasOptimisticState,
    renderedProposalSignature,
    resetOptimisticState,
    serverProposalSignature,
  ]);

  // オフライン/再接続中は楽観状態をクリアしてサーバー値に揃える
  useEffect(() => {
    if (!presenceReady) {
      resetOptimisticState("forced-sync");
    }
  }, [presenceReady, resetOptimisticState]);

  // 強制同期: 楽観状態は最長 ~1.7–1.9s でサーバー値に揃える
  useEffect(() => {
    if (!hasOptimisticState) {
      clearForceResyncTimer();
      return undefined;
    }
    if (typeof window === "undefined") return undefined;
    const sessionId = optimisticSessionRef.current + 1;
    optimisticSessionRef.current = sessionId;
    clearForceResyncTimer();
    const timeoutMs = prefersReducedMotion ? 1900 : 1700;
    forceResyncTimerRef.current = window.setTimeout(() => {
      if (optimisticSessionRef.current !== sessionId) return;
      resetOptimisticState("forced-sync");
      forceResyncTimerRef.current = null;
    }, timeoutMs);
    return () => {
      clearForceResyncTimer();
    };
  }, [
    clearForceResyncTimer,
    hasOptimisticState,
    optimisticStateKey,
    prefersReducedMotion,
    resetOptimisticState,
  ]);

  const slotCountTarget = useMemo(() => {
    // サーバー計算済みの slotCount を信頼し、在室人数で最低値を張る。pending やローカル提案では揺らさない。
    return computeSlotCountTarget(slotCount, availableEligibleCount);
  }, [slotCount, availableEligibleCount]);

  const { resolvedSlotCount, beginDropSession, endDropSession } =
    useResolvedSlotCount({ slotCountTarget, prefersReducedMotion });

  const paddedBoardProposal = useMemo<(string | null)[]>(() => {
    const target = resolvedSlotCount;
    if (boardProposal.length >= target) return boardProposal;
    const next = boardProposal.slice();
    while (next.length < target) {
      next.push(null);
    }
    return next;
  }, [boardProposal, resolvedSlotCount]);

  const placeholderSlots = useMemo(() => {
    return buildPlaceholderSlots({ boardProposal, missingPlayerIds });
  }, [boardProposal, missingPlayerIds]);

  usePlaceholderSlotTrace({ placeholderSlots, roomId });

  useEffect(() => {
    if (!optimisticProposal) return;
    const optimisticKey = buildProposalSignature(optimisticProposal);
    if (optimisticKey === serverProposalSignature) {
      setOptimisticProposal(null);
    }
  }, [optimisticProposal, serverProposalSignature]);

  // サーバー側からカードが消えているのに、ローカルの楽観提案にだけ残ってしまうケースを補正する
  useEffect(() => {
    if (!optimisticProposal) return;
    const sanitized = sanitizeOptimisticProposal({
      optimisticProposal,
      serverProposal: proposal,
    });
    if (!sanitized) {
      setOptimisticProposal(null);
      return;
    }

    if (shallowArrayEqual(optimisticProposal, sanitized)) return;
    setOptimisticProposal(sanitized);
  }, [optimisticProposal, proposal, proposalKey]);

  useEffect(() => {
    if (roomStatus !== "clue" && optimisticProposal) {
      setOptimisticProposal(null);
    }
  }, [roomStatus, optimisticProposal]);

  const proposalSyncRef = useRef<string | null>(null);
  useEffect(() => {
    if (!proposalKey) {
      proposalSyncRef.current = null;
      return;
    }
    if (proposalSyncRef.current === proposalKey) {
      return;
    }
    proposalSyncRef.current = proposalKey;
    const activeCount = countActiveProposalIds(activeProposal);
    traceAction("proposal.sync", {
      roomId,
      activeProposalLen: activeCount,
      orderListLen: orderListLength,
      source: "firestore",
    });
  }, [proposalKey, roomId, activeProposal, orderListLength]);

  const slotCountDragging = resolvedSlotCount;
  const slotCountStatic = resolvedSlotCount;

  const isGameActive = useMemo(() => isGameActiveStatus(roomStatus), [roomStatus]);

  const { dragSlots, staticSlots, waitingPlayers } = useBoardSlots({
    slotCountDragging,
    slotCountStatic,
    activeProposal: paddedBoardProposal,
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

  const dumpBoardState = useCallback(() => {
    return {
      roomId,
      timestamp: Date.now(),
      proposal: activeProposal,
      renderedProposal: boardProposal,
      optimisticProposal,
      pending,
      placeholders: placeholderSlots,
      waiting: waitingPlayers.map((player) => ({
        id: player.id,
        name: player.name,
      })),
      eligibleIds,
      missingPlayerIds,
      roomStatus,
    };
  }, [
    roomId,
    activeProposal,
    boardProposal,
    optimisticProposal,
    pending,
    placeholderSlots,
    waitingPlayers,
    eligibleIds,
    missingPlayerIds,
    roomStatus,
  ]);

  useBoardDebugDump({ enabled: dropDebugEnabled, dump: dumpBoardState });

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

  useRevealDoneFallback({
    roomId,
    roomStatus,
    resolveMode,
    orderListLength,
    finalizeScheduled,
    sendRoomEvent,
    resultIntroReadyAt,
  });

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      traceAction("drag.start", { activeId: String(event.active.id) });
      beginDropSession();
      updateBoardBounds();
      updateDropAnimationTarget(null);
      resetMagnet({ immediate: true });
      setActiveId(String(event.active.id));
      setDragBoostEnabled((prev) => (prev ? prev : true));
      if (
        dragActivationStartRef.current !== null &&
        typeof performance !== "undefined"
      ) {
        const latency = Math.max(
          0,
          performance.now() - dragActivationStartRef.current
        );
        setMetric("drag", "activationLatencyMs", Math.round(latency));
      }
      dragActivationStartRef.current = null;
      playDragPickup();
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.vibrate === "function"
      ) {
        try {
          navigator.vibrate(6);
        } catch {
          // 触覚フィードバックの失敗は無視
        }
      }

      const coordinates = event.activatorEvent
        ? getEventCoordinates(event.activatorEvent)
        : null;
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
      updateBoardBounds,
      resetMagnet,
      playDragPickup,
      setCursorSnapOffset,
      updateDropAnimationTarget,
    ]
  );

  const clearActive = useCallback(
    (options?: { delayMagnetReset?: boolean }) => {
      unstable_batchedUpdates(() => {
        setIsOver(false);
        setActiveId(null);
        setCursorSnapOffset(null);
      });
      const shouldDelay = options?.delayMagnetReset ?? false;
      if (!shouldDelay) {
        queueMagnetReset(0);
        return;
      }
      const currentMagnetState = getProjectedMagnetState();
      const baseDelay = prefersReducedMotion
        ? 130
        : currentMagnetState.shouldSnap
          ? 220
          : 260;
      queueMagnetReset(baseDelay);
    },
    [
      getProjectedMagnetState,
      prefersReducedMotion,
      queueMagnetReset,
      setIsOver,
      setCursorSnapOffset,
    ]
  );

  const cancelActiveDrag = useCallback(
    (reason: "visibilitychange" | "pointercancel" | "touchcancel" | "blur") => {
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
    [activeId, cancelPendingDragMove, clearActive, endDropSession, updateDropAnimationTarget]
  );
  useActiveDragCancelFallback({ activeId, cancel: cancelActiveDrag });

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!activeId) {
        cancelPendingDragMove();
        return;
      }
      traceAction("drag.end", {
        activeId: String(active.id),
        overId: over ? String(over.id) : null,
      });
      cancelPendingDragMove();
      const activeRect = getActiveRectWithDelta(active, event.delta);
      if (activeRect) {
        lastDragPositionRef.current = {
          x: activeRect.left + activeRect.width / 2,
          y: activeRect.top + activeRect.height / 2,
        };
      }
      const overRect = over?.rect ?? null;
      let magnetResult = createInitialMagnetState();
      updateDropAnimationTarget(null);

      try {
        if (resolveMode !== "sort-submit" || roomStatus !== "clue") return;

        const activePlayerId = String(active.id);
        const alreadyInProposal = (boardProposal as (string | null)[]).includes(
          activePlayerId
        );
        const isPendingOnly =
          !alreadyInProposal && pendingRef.current.includes(activePlayerId);
        const alreadyPlaced = alreadyInProposal || isPendingOnly;
        const isSlotTarget =
          over && typeof over.id === "string" && over.id.startsWith("slot-");
        const isReturnTarget =
          over &&
          typeof over.id === "string" &&
          over.id === RETURN_DROP_ZONE_ID;

        const boardRect = boardContainerRef.current?.getBoundingClientRect();
        const lastPosition = lastDragPositionRef.current;
        const fallbackReturn =
          !isReturnTarget &&
          !isSlotTarget &&
          alreadyPlaced &&
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
          if (!alreadyPlaced) {
            playDropInvalid();
            return;
          }
          if (activePlayerId !== meId) {
            playDropInvalid();
            notify({
              title: "自分のカードだけ戻せます",
              type: "info",
              duration: 1200,
            });
            return;
          }
          initiateReturn();
          return;
        }

        if (!over) {
          playDropInvalid();
          notify({
            title: "この位置には置けません",
            type: "info",
            duration: 900,
          });
          return;
        }

        if (active.id === over.id) return;

        const overId = String(over.id);

        if (overId === RETURN_DROP_ZONE_ID) {
          if (!alreadyPlaced) {
            playDropInvalid();
            return;
          }
          if (activePlayerId !== meId) {
            playDropInvalid();
            notify({
              title: "自分のカードだけ戻せます",
              type: "info",
              duration: 1200,
            });
            return;
          }
          initiateReturn();
          return;
        }

        if (isSlotTarget && overRect) {
          const currentMagnetState = getProjectedMagnetState();
          updateDropAnimationTarget(overRect as RectLike, {
            magnetSnap: currentMagnetState.shouldSnap,
          });
          magnetResult = computeMagnetTransform(overRect, activeRect, {
            ...magnetConfigRef.current,
            projectedOffset: {
              dx: currentMagnetState.dx + (cursorSnapOffset?.x ?? 0),
              dy: currentMagnetState.dy + (cursorSnapOffset?.y ?? 0),
            },
          });
          let slotIndex = parseInt(overId.split("-")[1], 10);
          if (!Number.isNaN(slotIndex)) {
            const maxSlots = Math.max(0, slotCountDragging - 1);
            const originalSlotIndex = slotIndex;
            slotIndex = Math.min(Math.max(0, slotIndex), maxSlots);

            if (
              process.env.NODE_ENV === "development" &&
              originalSlotIndex !== slotIndex
            ) {
              logWarn("central-card-board", "slot-index-clamped", {
                originalSlotIndex,
                slotIndex,
                maxSlots,
                slotCountDragging,
              });
            }

            let dropSession: ReturnType<
              typeof createDropMetricsSession
            > | null = null;
            let previousPending: (string | null)[] | undefined;
            let insertedPending = false;
            let didPlaySound = false;
            const playOnce = () => {
              if (didPlaySound) return;
              didPlaySound = true;
              playCardPlace();
              dropSession?.markStage("client.drop.t3_soundPlayedMs", {
                channel: "success",
              });
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
              if (insertedPending) {
                scheduleDropRollback(
                  activePlayerId,
                  previousPending ? previousPending.slice() : []
                );
              }
            }

            if (alreadyInProposal) {
              playOnce();
              scheduleMoveCardInProposalToPosition(
                roomId,
                activePlayerId,
                slotIndex
              ).catch((error) => {
                logError("central-card-board", "move-card-in-proposal", error);
                playDropInvalid();
                setOptimisticProposal(null);
                // エラー時は楽観返却状態もクリア
                setOptimisticReturningIds((prev) =>
                  prev.filter((id) => id !== activePlayerId)
                );
              });
              applyOptimisticReorder(activePlayerId, slotIndex);
              return;
            }

            const request = scheduleAddCardToProposalAtPosition(
              roomId,
              activePlayerId,
              slotIndex
            );
            if (insertedPending) {
              playOnce();
            }
              request
                .then((result) => {
                  clearDropRollbackTimer(activePlayerId);
                  dropSession?.markStage("client.drop.t2_addProposalResolvedMs", {
                  result,
                });
                if (result === "noop") {
                  dropSession?.complete("noop");
                  onOptimisticProposalChange?.(activePlayerId, null);
                  // noop 時は optimisticProposal もクリア
                  setOptimisticProposal(null);
                  if (previousPending !== undefined) {
                    const snapshot = previousPending.slice();
                    updatePendingState(() => snapshot);
                  }
                  notify({
                    title: "その位置には置けません",
                    description:
                      "カードが既に置かれているか、提案が更新されています。",
                    type: "info",
                  });
                  playDropInvalid();
                  dropSession?.markStage("client.drop.t1_notifyShownMs", {
                    origin: "post",
                  });
                  traceAction("board.drop.attempt", {
                    roomId,
                    playerId: activePlayerId,
                    targetSlot: slotIndex,
                    reasonIfRejected: "slot-occupied",
                  });
                  return;
                }
                playOnce();
                dropSession?.complete("success");
                })
                .catch((error) => {
                  clearDropRollbackTimer(activePlayerId);
                  dropSession?.markStage("client.drop.t2_addProposalResolvedMs", {
                    result: "error",
                  });
                  dropSession?.complete("error");
                  logError("central-card-board", "add-card-to-proposal", error);
                  onOptimisticProposalChange?.(activePlayerId, null);
                  // エラー時も optimisticProposal をクリア
                  setOptimisticProposal(null);
                  if (previousPending !== undefined) {
                    const snapshot = previousPending.slice();
                    updatePendingState(() => snapshot);
                  }
                  const errorCode = (error as { code?: unknown } | null)?.code;
                  const isNetworkError = error instanceof TypeError || errorCode === "timeout";
                  notify({
                    title: isNetworkError
                      ? "通信に失敗しました"
                      : "カードをその位置に置けませんでした",
                    description: isNetworkError
                      ? "ネットワークが不安定か、サーバーが応答しませんでした。もう一度お試しください。"
                      : error instanceof Error
                        ? error.message
                        : undefined,
                    type: "error",
                    duration: 1400,
                    meta: {
                      cooldownMs: 1200,
                      cooldownKey: `drop:proposal:${roomId}`,
                    },
                  });
                  playDropInvalid();
                  dropSession?.markStage("client.drop.t1_notifyShownMs", {
                    origin: "error",
                  });
                  traceAction("board.drop.attempt", {
                  roomId,
                  playerId: activePlayerId,
                  targetSlot: slotIndex,
                  reasonIfRejected: "error",
                });
              });
            return;
          }
          return;
        }

        if (alreadyInProposal) {
          const targetIndex = (boardProposal as (string | null)[]).indexOf(
            overId
          );
          if (targetIndex < 0) {
            playDropInvalid();
            return;
          }
          playCardPlace();
          scheduleMoveCardInProposalToPosition(
            roomId,
            activePlayerId,
            targetIndex
          ).catch((error) => {
            logError("central-card-board", "move-card-in-proposal", error);
            playDropInvalid();
            const errorCode = (error as { code?: unknown } | null)?.code;
            const isNetworkError = error instanceof TypeError || errorCode === "timeout";
            notify({
              title: isNetworkError
                ? "通信に失敗しました"
                : "カードをその位置に移動できませんでした",
              description: isNetworkError
                ? "ネットワークが不安定か、サーバーが応答しませんでした。もう一度お試しください。"
                : error instanceof Error
                  ? error.message
                  : undefined,
              type: "error",
              duration: 1400,
              meta: {
                cooldownMs: 1200,
                cooldownKey: `drop:proposal:${roomId}`,
              },
            });
            setOptimisticProposal(null);
            // エラー時は楽観返却状態もクリア
            setOptimisticReturningIds((prev) =>
              prev.filter((id) => id !== activePlayerId)
            );
          });
          applyOptimisticReorder(activePlayerId, targetIndex);
        }
      } finally {
        enqueueMagnetUpdate({ state: magnetResult, immediate: true });
        clearActive({ delayMagnetReset: true });
        endDropSession();
      }
    },
    [
      activeId,
      cancelPendingDragMove,
      enqueueMagnetUpdate,
      getProjectedMagnetState,
      resolveMode,
      roomStatus,
      playDropInvalid,
      playCardPlace,
      returnCardToWaiting,
      meId,
      updatePendingState,
      roomId,
      slotCountDragging,
      clearActive,
      updateDropAnimationTarget,
      onOptimisticProposalChange,
      magnetConfigRef,
      cursorSnapOffset,
      applyOptimisticReorder,
      boardProposal,
      scheduleDropRollback,
      clearDropRollbackTimer,
      endDropSession,
    ]
  );

  const onDragCancel = useCallback(() => {
    traceAction("drag.cancel");
    dragActivationStartRef.current = null;
    updateDropAnimationTarget(null);
    cancelPendingDragMove();
    clearActive();
    endDropSession();
  }, [cancelPendingDragMove, clearActive, updateDropAnimationTarget, endDropSession]);

  const activeBoard =
    interactionEnabled && resolveMode === "sort-submit" && roomStatus === "clue";

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
          touchAction: "pan-y",
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
            ? realtimeResult?.failedAt !== null &&
              realtimeResult?.failedAt !== undefined
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
        {activeBoard ? (
          <InteractiveBoard
            slots={dragSlots}
            magnetController={magnetController}
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
            activeProposal={boardProposal}
            waitingPlayers={waitingPlayers}
            meId={meId}
            displayMode={displayMode}
            roomStatus={roomStatus}
            boardRef={handleBoardRef}
            isRevealing={isRevealing}
            cursorSnapOffset={cursorSnapOffset}
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
      {roomStatus === "finished" && resultOverlayAllowed && (
        <GameResultOverlay
          failed={failed}
          mode="overlay"
          revealedAt={revealedAt}
        />
      )}
      <StreakBanner
        streak={currentStreak}
        isVisible={showStreakBanner}
        onComplete={() => setShowStreakBanner(false)}
      />
    </Box>
  );
};

export default CentralCardBoard;
