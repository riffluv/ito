"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, VisuallyHidden } from "@chakra-ui/react";
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DropAnimation,
} from "@dnd-kit/core";
import { restrictToFirstScrollableAncestor, restrictToWindowEdges } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { unstable_batchedUpdates } from "react-dom";
import Tooltip from "@/components/ui/Tooltip";
import WaitingArea from "@/components/ui/WaitingArea";
import { SortableItem } from "@/components/sortable/SortableItem";
import { CardRenderer } from "@/components/ui/CardRenderer";
import { EmptyCard } from "@/components/cards";
import { GameResultOverlay } from "@/components/ui/GameResultOverlay";
import { useDropHandler } from "@/components/hooks/useDropHandler";
import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import {
  addCardToProposalAtPosition,
  finalizeReveal,
  moveCardInProposalToPosition,
  removeCardFromProposal,
  submitSortedOrder,
} from "@/lib/game/room";
import type { ResolveMode } from "@/lib/game/resolveMode";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { notify } from "@/components/ui/notify";
import { logError, logWarn } from "@/lib/utils/log";
import { REVEAL_FIRST_DELAY, REVEAL_LINGER, REVEAL_STEP_DELAY } from "@/lib/ui/motion";
import { computeMagnetTransform, type MagnetResult } from "@/lib/ui/dragMagnet";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
import useReducedMotionPreference from "@/hooks/useReducedMotionPreference";

interface CentralCardBoardProps {
  roomId: string;
  players: (PlayerDoc & { id: string })[];
  orderList: string[];
  meId: string;
  eligibleIds: string[];
  roomStatus: RoomDoc["status"];
  cluesReady?: boolean;
  failed: boolean;
  proposal?: string[];
  resolveMode?: ResolveMode | null;
  orderNumbers?: Record<string, number | null | undefined>;
  isHost?: boolean;
  displayMode?: "full" | "minimal";
  slotCount?: number;
  topic?: string | null;
  revealedAt?: unknown;
}

interface SlotDescriptorBase {
  idx: number;
  totalSlots: number;
  droppableId: string;
  cardId: string | null;
  showCard: boolean;
  ready: boolean;
  isOptimisticReturning: boolean;
}

interface DragSlotDescriptor extends SlotDescriptorBase {
  proposalCardId: string | null;
  pendingCardId: string | null;
}

interface StaticSlotDescriptor extends SlotDescriptorBase {
  allowDrop: boolean;
}

interface MagnetSnapshot {
  targetId: string | null;
  strength: number;
}

const RETURN_DROP_ZONE_ID = "waiting-return-zone";

const BOARD_FRAME_STYLES = {
  containerType: "inline-size",
  [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
    gap: "8px",
    padding: "8px 12px",
    "& > *": {
      minWidth: UNIFIED_LAYOUT.DPI_125.CARD.WIDTH.base,
    },
  },
  [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
    gap: `${UNIFIED_LAYOUT.DPI_150.SPACING.CARD_GAP} !important`,
    rowGap: `${UNIFIED_LAYOUT.DPI_150.SPACING.ROW_GAP} !important`,
    padding: `${UNIFIED_LAYOUT.DPI_150.SPACING.COMPONENT_PADDING} !important`,
    minHeight: "auto !important",
    alignContent: "flex-start !important",
    "& > *": {
      minWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.base,
      maxWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.base,
    },
    [`@media (min-width: 768px)`]: {
      "& > *": {
        minWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.md,
        maxWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.md,
      },
    },
  },
  [`@media ${UNIFIED_LAYOUT.BREAKPOINTS.MOBILE}`]: {
    gap: "10px",
    padding: "12px",
  },
  "@container (max-width: 600px)": {
    gap: "6px",
    padding: "8px",
  },
} as const;

const GHOST_CARD_STYLE: React.CSSProperties = {
  filter: UI_TOKENS.FILTERS.dropShadowStrong,
  opacity: 0.98,
  pointerEvents: "none",
  willChange: "transform",
};

const createInitialMagnetState = (): MagnetResult => ({
  dx: 0,
  dy: 0,
  strength: 0,
  distance: Number.POSITIVE_INFINITY,
  shouldSnap: false,
});

const shallowArrayEqual = (a: readonly string[], b: readonly string[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const boardCollisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length) return within;

  const { collisionRect, droppableRects } = args;
  if (!collisionRect) return [];

  const dragCenter = {
    x: collisionRect.left + collisionRect.width / 2,
    y: collisionRect.top + collisionRect.height / 2,
  };

  const distances: { id: unknown; value: number }[] = [];
  droppableRects.forEach((rect, id) => {
    const dropCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const dx = dragCenter.x - dropCenter.x;
    const dy = dragCenter.y - dropCenter.y;
    distances.push({ id, value: Math.hypot(dx, dy) });
  });

  distances.sort((a, b) => a.value - b.value);

  const best = distances[0];
  if (best) {
    const rect = droppableRects.get(best.id as any);
    if (rect) {
      const dynamicThreshold = Math.max(60, Math.min(140, rect.width * 0.6));
      if (best.value <= dynamicThreshold) {
        return [{ id: best.id, data: { value: best.value } } as any];
      }
    }
  }

  return rectIntersection(args);
};

function BoardFrameBase({
  isActive,
  children,
  containerRef,
}: {
  isActive: boolean;
  children: React.ReactNode;
  containerRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <Box
      ref={containerRef}
      borderWidth="0"
      border="borders.retrogameThin"
      borderColor={UI_TOKENS.COLORS.whiteAlpha90}
      borderRadius={0}
      padding={{ base: 3, md: 4 }}
      minHeight="auto"
      width="100%"
      maxWidth="var(--board-max-width)"
      marginInline="auto"
      display="flex"
      flexWrap="wrap"
      justifyContent="center"
      alignContent="flex-start"
      alignItems="flex-start"
      gap={UNIFIED_LAYOUT.SPACING.CARD_GAP}
      transition="background-color 0.28s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.28s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.28s cubic-bezier(0.4, 0, 0.2, 1)"
      data-drop-target={isActive ? "true" : "false"}
      css={BOARD_FRAME_STYLES}
    >
      <Box width="100%" css={{ display: "contents" }}>
        {children}
      </Box>
    </Box>
  );
}

const BoardFrame = React.memo(BoardFrameBase);
BoardFrame.displayName = "CentralBoardFrame";

function InteractiveBoardBase({
  slots,
  magnetSnapshot,
  prefersReducedMotion,
  activeId,
  isOver,
  canDrop,
  sensors,
  collisionDetection,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  dropAnimation,
  renderCard,
  activeProposal,
  waitingPlayers,
  meId,
  displayMode,
  roomStatus,
  boardRef,
}: {
  slots: DragSlotDescriptor[];
  magnetSnapshot: MagnetSnapshot;
  prefersReducedMotion: boolean;
  activeId: string | null;
  isOver: boolean;
  canDrop: boolean;
  sensors: ReturnType<typeof useSensors>;
  collisionDetection: CollisionDetection;
  onDragStart: (event: DragStartEvent) => void;
  onDragMove: (event: DragMoveEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  dropAnimation: DropAnimation;
  renderCard: (id: string, idx?: number) => React.ReactNode;
  activeProposal: (string | null)[];
  waitingPlayers: (PlayerDoc & { id: string })[];
  meId: string;
  displayMode?: "full" | "minimal";
  roomStatus: RoomDoc["status"];
  boardRef: React.RefObject<HTMLDivElement>;
}) {
  const sortableItems = useMemo(
    () => activeProposal.filter((id): id is string => typeof id === "string" && id.length > 0),
    [activeProposal]
  );

  return (
    <DndContext
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      sensors={sensors}
      modifiers={[restrictToFirstScrollableAncestor]}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => {
            const id = String(active.id);
            return `${id}のカードをドラッグ開始`;
          },
          onDragOver: ({ active, over }) => {
            if (over) {
              const overIndex = activeProposal.indexOf(over.id as string);
              return `${String(active.id)}を${overIndex + 1}番スロットに移動中`;
            }
            return `${String(active.id)}を移動中`;
          },
          onDragEnd: ({ active, over }) => {
            if (over) {
              const overIndex = activeProposal.indexOf(over.id as string);
              return `${String(active.id)}を${overIndex + 1}番スロットに配置`;
            }
            return `${String(active.id)}の移動をキャンセル`;
          },
          onDragCancel: ({ active }) => `${String(active.id)}のドラッグをキャンセル`,
        },
      }}
    >
      <BoardFrame isActive={isOver && canDrop} containerRef={boardRef}>
        <SortableContext items={sortableItems}>
          {slots.map((slot) => {
            if (slot.showCard && slot.cardId) {
              if (slot.proposalCardId && slot.proposalCardId === slot.cardId) {
                return (
                  <SortableItem id={slot.cardId} key={slot.cardId}>
                    {renderCard(slot.cardId, slot.idx)}
                  </SortableItem>
                );
              }
              return (
                <React.Fragment key={`ghost-${slot.idx}-${slot.cardId}`}>
                  {renderCard(slot.cardId, slot.idx)}
                </React.Fragment>
              );
            }

            const isTarget = magnetSnapshot.targetId === slot.droppableId;
            return (
              <EmptyCard
                key={`slot-${slot.idx}`}
                slotNumber={slot.idx + 1}
                totalSlots={slot.totalSlots}
                alignSelf="flex-start"
                id={slot.droppableId}
                isDroppable
                isDragActive={!!activeId}
                isMagnetTarget={isTarget}
                magnetStrength={isTarget ? magnetSnapshot.strength : 0}
                prefersReducedMotion={prefersReducedMotion}
              />
            );
          })}
        </SortableContext>
      </BoardFrame>

      <DragOverlay dropAnimation={dropAnimation} modifiers={[restrictToWindowEdges]}>
        {activeId
          ? (() => {
              const idx = activeProposal.indexOf(activeId);
              if (idx >= 0) {
                return <div style={GHOST_CARD_STYLE}>{renderCard(activeId, idx)}</div>;
              }
              return <div style={GHOST_CARD_STYLE}>{renderCard(activeId)}</div>;
            })()
          : null}
      </DragOverlay>

      {(roomStatus === "clue" || roomStatus === "waiting") && waitingPlayers.length > 0 && (
        <Box
          width="100%"
          maxWidth="var(--board-max-width)"
          marginInline="auto"
          mt={{ base: 4, md: 5 }}
          css={{
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
              marginTop: "1.25rem !important",
            },
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
              marginTop: "1rem !important",
            },
          }}
        >
          <WaitingArea
            players={waitingPlayers}
            isDraggingEnabled
            meId={meId}
            displayMode={displayMode}
            returnDropZoneId={RETURN_DROP_ZONE_ID}
            hideClues={roomStatus !== "clue"}
            gameStarted={roomStatus === "clue"}
          />
        </Box>
      )}
    </DndContext>
  );
}

const InteractiveBoard = React.memo(InteractiveBoardBase);
InteractiveBoard.displayName = "CentralInteractiveBoard";

function StaticBoardBase({
  slots,
  renderCard,
  isOver,
  canDrop,
  roomStatus,
  waitingPlayers,
  meId,
  displayMode,
  onDropAtPosition,
  onSlotEnter,
  onSlotLeave,
}: {
  slots: StaticSlotDescriptor[];
  renderCard: (id: string, idx: number) => React.ReactNode;
  isOver: boolean;
  canDrop: boolean;
  roomStatus: RoomDoc["status"];
  waitingPlayers: (PlayerDoc & { id: string })[];
  meId: string;
  displayMode?: "full" | "minimal";
  onDropAtPosition: (event: React.DragEvent, index: number) => void;
  onSlotEnter: (index: number) => void;
  onSlotLeave: () => void;
}) {
  return (
    <>
      <BoardFrame isActive={isOver && canDrop}>
        {slots.map((slot) => {
          if (slot.showCard && slot.cardId) {
            return (
              <React.Fragment key={slot.cardId ?? `slot-${slot.idx}`}>
                {renderCard(slot.cardId, slot.idx)}
              </React.Fragment>
            );
          }

          if (slot.allowDrop) {
            return (
              <EmptyCard
                key={`drop-zone-${slot.idx}`}
                slotNumber={slot.idx + 1}
                totalSlots={slot.totalSlots}
                isDroppable
                alignSelf="flex-start"
                onDragOver={() => onSlotEnter(slot.idx)}
                onDragLeave={onSlotLeave}
                onDrop={(event) => onDropAtPosition(event, slot.idx)}
                _focusVisible={{
                  outline: "2px solid",
                  outlineColor: "focusRing",
                  outlineOffset: 2,
                }}
                tabIndex={0}
              />
            );
          }

          return (
            <Tooltip
              key={`drop-zone-${slot.idx}`}
              content="このスロットはまだ使用できません"
              openDelay={300}
              showArrow
            >
              <Box display="inline-flex">
                <EmptyCard
                  slotNumber={slot.idx + 1}
                  totalSlots={slot.totalSlots}
                  isDroppable={false}
                  alignSelf="flex-start"
                  onDragOver={() => {}}
                  onDragLeave={onSlotLeave}
                  onDrop={() => {}}
                  _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "focusRing",
                    outlineOffset: 2,
                  }}
                  tabIndex={0}
                />
              </Box>
            </Tooltip>
          );
        })}
      </BoardFrame>

      {(roomStatus === "clue" || roomStatus === "waiting") && waitingPlayers.length > 0 && (
        <Box
          width="100%"
          maxWidth="var(--board-max-width)"
          marginInline="auto"
          mt={{ base: 4, md: 5 }}
          css={{
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
              marginTop: "1.25rem !important",
            },
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
              marginTop: "1rem !important",
            },
          }}
        >
          <WaitingArea
            players={waitingPlayers}
            isDraggingEnabled={false}
            meId={meId}
            displayMode={displayMode}
            hideClues={roomStatus !== "clue"}
            gameStarted={roomStatus === "clue"}
          />
        </Box>
      )}
    </>
  );
}

const StaticBoard = React.memo(StaticBoardBase);
StaticBoard.displayName = "CentralStaticBoard";

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
  isHost,
  orderNumbers = {},
  displayMode = "full",
  slotCount,
  revealedAt,
}) => {
  const playerMap = useMemo(() => {
    const map = new Map<string, PlayerDoc & { id: string }>();
    players.forEach((player) => {
      if (player && player.id) {
        map.set(player.id, player);
      }
    });
    return map;
  }, [players]);

  const placedIds = useMemo(
    () => new Set<string>([...(orderList || []), ...(proposal || [])]),
    [orderList?.join(","), proposal?.join(",")]
  );

  const me = useMemo(() => playerMap.get(meId), [playerMap, meId]);
  const hasNumber = useMemo(() => !!me?.number, [me?.number]);
  const mePlaced = useMemo(() => placedIds.has(meId), [placedIds, meId]);

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

  const magnetConfig = useMemo(
    () => ({
      snapRadius: prefersReducedMotion ? 90 : 140,
      snapThreshold: prefersReducedMotion ? 52 : 92,
      maxOffset: prefersReducedMotion ? 16 : 34,
    }),
    [prefersReducedMotion]
  );
  const magnetConfigRef = useRef(magnetConfig);
  useEffect(() => {
    magnetConfigRef.current = magnetConfig;
  }, [magnetConfig]);
  const boardContainerRef = useRef<HTMLDivElement | null>(null);
  const lastDragPositionRef = useRef<{ x: number; y: number } | null>(null);

  const resetMagnet = useCallback((options?: { immediate?: boolean }) => {
    const immediate = options?.immediate ?? false;
    if (
      magnetStateRef.current.strength === 0 &&
      !magnetStateRef.current.shouldSnap &&
      magnetTargetRef.current === null
    ) {
      if (immediate) {
        setMagnetTargetId(null);
      }
      return;
    }

    if (typeof window !== "undefined" && magnetHighlightTimeoutRef.current != null) {
      window.clearTimeout(magnetHighlightTimeoutRef.current);
      magnetHighlightTimeoutRef.current = null;
    }

    magnetTargetRef.current = null;
    const next = createInitialMagnetState();
    magnetStateRef.current = next;
    setMagnetState(next);

    if (immediate) {
      setMagnetTargetId(null);
    } else {
      setMagnetTargetId((prev) => (prev === null ? prev : null));
    }
  }, []);

  const scheduleMagnetTarget = useCallback(
    (nextId: string | null) => {
      if (magnetTargetRef.current === nextId) return;
      if (typeof window !== "undefined" && magnetHighlightTimeoutRef.current != null) {
        window.clearTimeout(magnetHighlightTimeoutRef.current);
        magnetHighlightTimeoutRef.current = null;
      }

      if (typeof window === "undefined") {
        magnetTargetRef.current = nextId;
        setMagnetTargetId(nextId);
        return;
      }

      const delay = prefersReducedMotion ? 36 : 90;
      if (delay <= 0) {
        magnetTargetRef.current = nextId;
        setMagnetTargetId(nextId);
        return;
      }

      magnetHighlightTimeoutRef.current = window.setTimeout(() => {
        magnetTargetRef.current = nextId;
        setMagnetTargetId(nextId);
        magnetHighlightTimeoutRef.current = null;
      }, delay);
    },
    [prefersReducedMotion]
  );

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && magnetHighlightTimeoutRef.current != null) {
        window.clearTimeout(magnetHighlightTimeoutRef.current);
        magnetHighlightTimeoutRef.current = null;
      }
    };
  }, []);

  const dropAnimation = useMemo<DropAnimation>(() => {
    if (prefersReducedMotion) {
      return { duration: 110, easing: "linear" };
    }
    return magnetState.shouldSnap
      ? { duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.4, 1)" }
      : { duration: 220, easing: UI_TOKENS.EASING.standard };
  }, [magnetState.shouldSnap, prefersReducedMotion]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    });

  const updatePendingState = useCallback(
    (updater: (prev: string[]) => string[]) => {
      setPending((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        return shallowArrayEqual(prev, next) ? prev : next;
      });
    },
    [setPending]
  );

  const optimisticReturningSet = useMemo(() => new Set(optimisticReturningIds), [optimisticReturningIds]);

  const availableEligibleCount = useMemo(() => {
    if (!Array.isArray(eligibleIds)) return 0;
    let count = 0;
    eligibleIds.forEach((id) => {
      if (playerMap.has(id)) {
        count += 1;
      }
    });
    return count;
  }, [eligibleIds, playerMap]);

  const playerReadyMap = useMemo(() => {
    const map = new Map<string, boolean>();
    playerMap.forEach((player, id) => {
      const clue = typeof player?.clue1 === "string" ? player.clue1.trim() : "";
      map.set(id, clue.length > 0);
    });
    return map;
  }, [playerMap]);

  const waitingPlayers = useMemo(() => {
    const pendingLookup = new Set((pending || []).filter(Boolean));
    return (eligibleIds || [])
      .map((id) => playerMap.get(id)!)
      .filter((player) => {
        if (!player) return false;
        if (pendingLookup.has(player.id)) return false;
        if (optimisticReturningSet.has(player.id)) return true;
        if (placedIds.has(player.id)) return false;
        return player.id !== activeId;
      });
  }, [eligibleIds, playerMap, placedIds, activeId, pending, optimisticReturningSet]);

  const playDropInvalid = useSoundEffect("drop_invalid");
  const playCardPlace = useSoundEffect("card_place");

  const { revealAnimating, revealIndex, realtimeResult } = useRevealAnimation({
    roomId,
    roomStatus,
    resolveMode: (resolveMode || undefined) as any,
    orderListLength: orderList?.length || 0,
    orderData:
      orderList && orderNumbers
        ? {
            list: orderList,
            numbers: orderNumbers,
          }
        : null,
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
  }, [proposal?.join(","), optimisticReturningIds.length]);

  useEffect(() => {
    if (roomStatus !== "clue") {
      setOptimisticReturningIds([]);
    }
  }, [roomStatus]);

  const [resultFlipMap, setResultFlipMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (roomStatus !== "finished") {
      setResultFlipMap({});
      return;
    }

    setResultFlipMap((prev) => {
      const next: Record<string, boolean> = {};
      let changed = false;
      (orderList ?? []).forEach((cardId) => {
        if (!cardId) return;
        const existing = prev[cardId];
        if (existing === undefined) {
          changed = true;
        }
        next[cardId] = existing ?? true;
      });
      if (Object.keys(prev).length !== Object.keys(next).length) {
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [orderList, roomStatus]);

  const handleResultCardFlip = useCallback(
    (cardId: string) => {
      if (roomStatus !== "finished") return;
      setResultFlipMap((prev) => {
        const current = prev[cardId] ?? true;
        return { ...prev, [cardId]: !current };
      });
    },
    [roomStatus]
  );

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
    [roomId, updatePendingState, playCardPlace, playDropInvalid, notify, logError]
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

  const orderListSet = useMemo(() => new Set(orderList || []), [orderList?.join(",")]);

  useEffect(() => {
    if (!orderList || orderList.length === 0) return;
    updatePendingState((cur) => cur.filter((id) => !orderListSet.has(id)));
  }, [orderListSet, orderList?.length, updatePendingState]);

  useEffect(() => {
    if (!proposal || proposal.length === 0) return;
    const present = new Set((proposal as (string | null)[]).filter(Boolean) as string[]);
    updatePendingState((cur) => cur.filter((id) => !present.has(id)));
  }, [proposal?.join(","), updatePendingState]);

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
          resolveMode={(resolveMode || undefined) as any}
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

  const activeProposal = useMemo<(string | null)[]>(() => {
    if (roomStatus === "finished") {
      return (orderList || []).map((id) => (typeof id === "string" && id.length > 0 ? id : null));
    }
    if (!Array.isArray(proposal)) return [];
    return proposal.map((id) => (typeof id === "string" && id.length > 0 ? id : null));
  }, [roomStatus, orderList?.join(","), proposal?.join(",")]);

  const proposalLength = activeProposal.length;

  const slotCountDragging = useMemo(() => {
    if (typeof slotCount === "number" && slotCount > 0) return slotCount;
    return Math.max(proposalLength, availableEligibleCount);
  }, [slotCount, proposalLength, availableEligibleCount]);

  const slotCountStatic = useMemo(() => {
    if (typeof slotCount === "number" && slotCount > 0) return slotCount;
    if (roomStatus === "reveal" || roomStatus === "finished") {
      return (orderList || []).length || 0;
    }
    return Math.max(proposalLength, availableEligibleCount);
  }, [slotCount, roomStatus, orderList?.length, proposalLength, availableEligibleCount]);

  const isGameActive = useMemo(
    () => roomStatus === "clue" || roomStatus === "reveal" || roomStatus === "finished",
    [roomStatus]
  );

  const dragSlots = useMemo<DragSlotDescriptor[]>(() => {
    return Array.from({ length: Math.max(0, slotCountDragging) }).map((_, idx) => {
      const proposalCardId = activeProposal[idx] ?? null;
      const pendingCardId = pending?.[idx] ?? null;
      const cardId = proposalCardId ?? pendingCardId ?? null;
      const ready = cardId ? playerReadyMap.get(cardId) ?? false : false;
      const isOptimistic = cardId != null && optimisticReturningSet.has(cardId);
      const showCard = !!cardId && ready && !isOptimistic;
      return {
        idx,
        totalSlots: slotCountDragging,
        droppableId: `slot-${idx}`,
        cardId,
        showCard,
        ready,
        isOptimisticReturning: isOptimistic,
        proposalCardId,
        pendingCardId,
      };
    });
  }, [slotCountDragging, activeProposal, pending, playerReadyMap, optimisticReturningSet]);

  const staticSlots = useMemo<StaticSlotDescriptor[]>(() => {
    return Array.from({ length: Math.max(0, slotCountStatic) }).map((_, idx) => {
      const proposalCardId = activeProposal[idx] ?? null;
      const orderCardId = orderList?.[idx] ?? null;
      const pendingCardId = pending?.[idx] ?? null;
      const cardId = proposalCardId ?? orderCardId ?? pendingCardId ?? null;
      const ready = cardId ? playerReadyMap.get(cardId) ?? false : false;
      const isOptimistic = cardId != null && optimisticReturningSet.has(cardId);
      const showCard = !!cardId && ready && !isOptimistic && isGameActive;
      return {
        idx,
        totalSlots: slotCountStatic,
        droppableId: `slot-${idx}`,
        cardId,
        showCard,
        ready,
        isOptimisticReturning: isOptimistic,
        allowDrop: canDropAtPosition(idx),
      };
    });
  }, [
    slotCountStatic,
    activeProposal,
    orderList,
    pending,
    playerReadyMap,
    optimisticReturningSet,
    isGameActive,
    canDropAtPosition,
  ]);

  const magnetSnapshot = useMemo<MagnetSnapshot>(
    () => ({ targetId: magnetTargetId, strength: magnetState.strength }),
    [magnetTargetId, magnetState.strength]
  );

  const handleSlotEnter = useCallback(
    (index: number) => {
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
    if (resolveMode === "sort-submit" && roomStatus === "reveal") {
      const n = (orderList || []).length;
      if (n > 0) {
        const total = REVEAL_FIRST_DELAY + Math.max(0, n - 1) * REVEAL_STEP_DELAY + REVEAL_LINGER + 200;
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = setTimeout(() => {
          finalizeReveal(roomId).catch(() => void 0);
        }, total);
        return () => {
          if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        };
      }
    }
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, [roomStatus, resolveMode, orderList?.length, roomId]);

  const proposedCount = Array.isArray(proposal)
    ? (proposal as (string | null)[]).filter(Boolean).length
    : 0;
  const canConfirm =
    resolveMode === "sort-submit" &&
    roomStatus === "clue" &&
    proposedCount === slotCountDragging &&
    slotCountDragging > 0 &&
    !!isHost;

  const onConfirm = useCallback(async () => {
    if (!canConfirm) return;
    try {
      await submitSortedOrder(roomId, (proposal as (string | null)[]).filter(Boolean) as string[]);
    } catch (error: any) {
      notify({
        title: "並びの確定に失敗しました",
        description:
          error?.message ||
          "提出枚数やカードの内容を確認して、もう一度お試しください。",
        type: "error",
      });
    }
  }, [canConfirm, roomId, proposal]);

  const magnetAwareDragMove = useCallback(
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

      if (!over || typeof over.id !== "string" || !over.id.startsWith("slot-")) {
        scheduleMagnetTarget(null);
        if (magnetStateRef.current.strength > 0 || magnetStateRef.current.shouldSnap) {
          const next = createInitialMagnetState();
          magnetStateRef.current = next;
          setMagnetState(next);
        }
        return;
      }

      scheduleMagnetTarget(String(over.id));

      const magnetResult = computeMagnetTransform(over.rect, activeRect, magnetConfigRef.current);

      const previous = magnetStateRef.current;
      const deltaX = Math.abs(previous.dx - magnetResult.dx);
      const deltaY = Math.abs(previous.dy - magnetResult.dy);
      const deltaStrength = Math.abs(previous.strength - magnetResult.strength);
      if (deltaX < 0.5 && deltaY < 0.5 && deltaStrength < 0.05 && previous.shouldSnap === magnetResult.shouldSnap) {
        return;
      }

      magnetStateRef.current = magnetResult;
      setMagnetState(magnetResult);
    },
    [resolveMode, roomStatus, scheduleMagnetTarget]
  );

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      resetMagnet({ immediate: true });
      setActiveId(String(event.active.id));
    },
    [resetMagnet]
  );

  const clearActive = useCallback(() => {
    unstable_batchedUpdates(() => {
      setIsOver(false);
      setActiveId(null);
    });
    resetMagnet({ immediate: true });
  }, [resetMagnet, setIsOver]);

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
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
          await returnCardToWaiting(activePlayerId);
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
          await returnCardToWaiting(activePlayerId);
          return;
        }

        if (isSlotTarget && overRect) {
          magnetResult = computeMagnetTransform(overRect, activeRect, magnetConfigRef.current);
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

            let previousPending: string[] | undefined;
            if (!alreadyInProposal) {
              updatePendingState((prev) => {
                previousPending = prev.slice();
                const next = [...prev];
                const exist = next.indexOf(activePlayerId);
                if (exist >= 0) next.splice(exist, 1);
                if (slotIndex >= next.length) {
                  next.length = slotIndex + 1;
                }
                next[slotIndex] = activePlayerId;
                return next;
              });
            }

            try {
              if (alreadyInProposal) {
                await moveCardInProposalToPosition(roomId, activePlayerId, slotIndex);
                playCardPlace();
                return;
              } else {
                const result = await addCardToProposalAtPosition(
                  roomId,
                  activePlayerId,
                  slotIndex
                );
                if (result === "noop") {
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
                  return;
                }
              }
              playCardPlace();
              return;
            } catch (error) {
              logError("central-card-board", "add-card-to-proposal", error);
              if (previousPending !== undefined) {
                const snapshot = previousPending.slice();
                updatePendingState(() => snapshot);
              }
              playDropInvalid();
              return;
            }
          }
          return;
        }

        if (alreadyInProposal) {
          const targetIndex = (activeProposal as (string | null)[]).indexOf(overId);
          if (targetIndex < 0) {
            playDropInvalid();
            return;
          }
          try {
            await moveCardInProposalToPosition(roomId, activePlayerId, targetIndex);
            playCardPlace();
          } catch {
            playDropInvalid();
          }
        }
      } finally {
        magnetStateRef.current = magnetResult;
        setMagnetState(magnetResult);
        clearActive();
      }
    },
    [
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
      }}
    >
      <VisuallyHidden aria-live="polite">
        {roomStatus === "reveal"
          ? `進行状況: ${revealIndex} / ${(orderList || []).length}`
          : roomStatus === "finished"
          ? realtimeResult?.failedAt != null
            ? `結果: ${realtimeResult.failedAt}番目で失敗`
            : "結果: 成功"
          : ""}
      </VisuallyHidden>

      <Box
        textAlign="center"
        marginBottom={{ base: "0.5rem", md: "0.75rem" }}
        flex="0 0 auto"
        width="100%"
        maxWidth="var(--board-max-width)"
        marginInline="auto"
        css={{
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            marginBottom: "0.5rem",
          },
        }}
      />

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
            magnetSnapshot={magnetSnapshot}
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
            boardRef={boardContainerRef}
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
