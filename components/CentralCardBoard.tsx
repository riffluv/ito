"use client";
import { useDropHandler } from "@/components/hooks/useDropHandler";
import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import { SortableItem } from "@/components/sortable/SortableItem";
import { CardRenderer } from "@/components/ui/CardRenderer";
import { GameResultOverlay } from "@/components/ui/GameResultOverlay";
import WaitingArea from "@/components/ui/WaitingArea";
import { MvpLedger } from "@/components/ui/MvpLedger";
import {
  addCardToProposalAtPosition,
  finalizeReveal,
  moveCardInProposalToPosition,
  removeCardFromProposal,
  submitSortedOrder,
} from "@/lib/game/room";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import type { ResolveMode } from "@/lib/game/resolveMode";
import { Box, Button, VisuallyHidden } from "@chakra-ui/react";
import Tooltip from "@/components/ui/Tooltip";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
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
} from "@dnd-kit/core";
import {
  restrictToFirstScrollableAncestor,
  restrictToWindowEdges,
} from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { unstable_batchedUpdates } from "react-dom";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
// Layout & animation constants sourced from theme/layout and existing motion logic
import { EmptyCard } from "@/components/cards";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
import { notify } from "@/components/ui/notify";
import { logError, logWarn } from "@/lib/utils/log";
import {
  REVEAL_FIRST_DELAY,
  REVEAL_STEP_DELAY,
  REVEAL_LINGER,
  RESULT_VISIBLE_MS,
} from "@/lib/ui/motion";

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
  displayMode?: "full" | "minimal"; // ????????
  // ????????????????????????/???????
  slotCount?: number;
  topic?: string | null;
}

const RETURN_DROP_ZONE_ID = "waiting-return-zone";

const shallowArrayEqual = (a: readonly string[], b: readonly string[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const CentralCardBoard: React.FC<CentralCardBoardProps> = ({
  roomId,
  players,
  orderList,
  meId,
  eligibleIds,
  roomStatus,
  cluesReady,
  failed,
  proposal,
  resolveMode = "sort-submit",
  isHost,
  orderNumbers = {},
  displayMode = "full",
  slotCount,
  topic = null,
}) => {
  const [isLedgerOpen, setLedgerOpen] = useState(false);

  useEffect(() => {
    if (roomStatus !== "finished" && isLedgerOpen) {
      setLedgerOpen(false);
    }
  }, [roomStatus, isLedgerOpen]);
  // Build quick lookup map (id -> player) - memoized for 8+ players performance
  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerDoc & { id: string }>();
    players.forEach((p) => {
      if (p && p.id) m.set(p.id, p);
    });
    return m;
  }, [players]);

  // Derive placedIds from current order & proposal - use Set for O(1) lookups
  const placedIds = useMemo(
    () => new Set<string>([...(orderList || []), ...(proposal || [])]),
    [orderList?.join(","), proposal?.join(",")]
  );

  // Memoize player data to avoid recalculation
  const me = useMemo(() => playerMap.get(meId), [playerMap, meId]);
  const hasNumber = useMemo(() => !!me?.number, [me?.number]);

  const [activeId, setActiveId] = useState<string | null>(null);


  // Accessibility sensors for keyboard and pointer interactions
  // Sensors: mouse uses small distance threshold; touch uses hold delay with tolerance
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 4,
      },
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

  // Collision detection: pointerWithin ? distance fallback ? rectIntersection
  // ?????????????????????????????????????
  const collisionDetection: CollisionDetection = (args) => {
    // 1) ????????? pointerWithin ????
    const within = pointerWithin(args);
    if (within.length) return within;

    const { collisionRect, droppableRects } = args;
    if (!collisionRect) return [];

    // 2) ????????????????????????????????
    const dragCenter = {
      x: collisionRect.left + collisionRect.width / 2,
      y: collisionRect.top + collisionRect.height / 2,
    };
    const distances: { id: any; value: number }[] = [];
    droppableRects.forEach((rect, id: any) => {
      const dropCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const dx = dragCenter.x - dropCenter.x;
      const dy = dragCenter.y - dropCenter.y;
      const distance = Math.hypot(dx, dy);
      distances.push({ id, value: distance });
    });
    distances.sort((a, b) => a.value - b.value);

    // ??????: ??????60%???60px / ??140px?
    const best = distances[0];
    if (best) {
      const rect = droppableRects.get(best.id as any)!;
      const dynamicThreshold = Math.max(60, Math.min(140, rect.width * 0.6));
      if (best.value <= dynamicThreshold) {
        return [{ id: best.id, data: { value: best.value } } as any];
      }
    }

    // 3) ??????????? rectIntersection ???????????????????
    return rectIntersection(args);
  };

  // Optimize mePlaced calculation using Set for O(1) lookup instead of O(n) includes
  const mePlaced = useMemo(() => {
    return placedIds.has(meId);
  }, [placedIds, meId]);

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

  // sequential ?? reveal hook ? pending ????????????????
  const {
    pending,
    setPending,
    isOver,
    setIsOver,
    canDrop,
    currentPlaced,
    onDrop,
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

  // 待機エリアはpending中のカードも除外して残像を防ぐ
  const waitingPlayers = useMemo(() => {
    const pendingLookup = new Set((pending || []).filter(Boolean));
    return (eligibleIds || [])
      .map((id) => playerMap.get(id)!)
      .filter((p) => {
        if (!p) return false;
        if (pendingLookup.has(p.id)) return false;
        if (placedIds.has(p.id)) return false;
        return p.id !== activeId;
      });
  }, [eligibleIds, playerMap, placedIds, activeId, pending]);

  // ??????????????????
  const [showResult, setShowResult] = useState(false);
  const [resultFlipMap, setResultFlipMap] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (roomStatus === "finished") {
      const appear = setTimeout(() => setShowResult(true), REVEAL_LINGER); // ??????
      const close = setTimeout(
        () => setShowResult(false),
        REVEAL_LINGER + RESULT_VISIBLE_MS
      );
      return () => {
        clearTimeout(appear);
        clearTimeout(close);
      };
    }
    setShowResult(false);
  }, [roomStatus]);

  useEffect(() => {
    if (roomStatus !== "finished") {
      setResultFlipMap({});
      return;
    }

    setResultFlipMap((prev) => {
      const next: Record<string, boolean> = {};
      let changed = false;
      (orderList ?? []).forEach((cardId) => {
        if (!cardId) {
          return;
        }
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

  // ??????: ?????????????????/???
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
  }, [roomStatus, realtimeResult?.failedAt]);

  // Clear pending when orderList updates - optimized Set lookup for 8+ players
  const orderListSet = useMemo(
    () => new Set(orderList || []),
    [orderList?.join(",")]
  );
  useEffect(() => {
    if (!orderList || orderList.length === 0) return;
    updatePendingState((cur) => cur.filter((id) => !orderListSet.has(id)));
  }, [orderListSet, orderList?.length, updatePendingState]);

  // proposal ???? proposal ??????ID? pending ???????
  useEffect(() => {
    if (!proposal || proposal.length === 0) return;
    const present = new Set(
      (proposal as (string | null)[]).filter(Boolean) as string[]
    );
    updatePendingState((cur) => cur.filter((id) => !present.has(id)));
  }, [proposal?.join(","), updatePendingState]);

  // ????/??????????? pending ?????????????
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

  // ⚡ PERFORMANCE: renderCard をuseCallback化
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
          // sort-submit ???????? revealIndex????????? progressive index
          revealIndex={revealIndex}
          revealAnimating={revealAnimating}
          failed={failed}
          realtimeResult={realtimeResult} // ?????????????
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

  // DnD sorting for sort-submit mode
  const activeProposal = useMemo(() => {
    // finished???????
    if (roomStatus === "finished") return orderList || [];
    // ????? null ???????????????null??????????
    return (proposal ?? []) as (string | null)[];
  }, [proposal?.join(","), orderList?.join(","), roomStatus]);

  // ??????????????????????????dragging/static???
  const slotCountDragging = useMemo(() => {
    if (typeof slotCount === "number" && slotCount > 0) return slotCount;
    return Math.max(
      (activeProposal as (string | null)[]).length || 0,
      Array.isArray(eligibleIds) ? eligibleIds.length : 0
    );
  }, [slotCount, (activeProposal as (string | null)[]).length, eligibleIds.length]);
  const slotCountStatic = useMemo(() => {
    if (typeof slotCount === "number" && slotCount > 0) return slotCount;
    if (roomStatus === "reveal" || roomStatus === "finished")
      return (orderList || []).length || 0;
    return Math.max(
      (activeProposal as (string | null)[]).length || 0,
      Array.isArray(eligibleIds) ? eligibleIds.length : 0
    );
  }, [slotCount, roomStatus, orderList?.length, (activeProposal as (string | null)[]).length, eligibleIds.length]);

  // ⚡ PERFORMANCE: onDragStart/clearActive をuseCallback化
  const onDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);
  const clearActive = useCallback(() => {
    unstable_batchedUpdates(() => {
      setIsOver(false);
      setActiveId(null);
    });
  }, [setIsOver]);

  // ⚡ PERFORMANCE: onDragEnd をuseCallback化
  const onDragEnd = useCallback(async (e: DragEndEvent) => {
    clearActive();
    if (resolveMode !== "sort-submit" || roomStatus !== "clue") return;
    const { active, over } = e;
    if (!over) {
      playDropInvalid();
      notify({ title: "この位置には置けません", type: "info", duration: 900 });
      return;
    }
    if (active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const alreadyInProposal = (activeProposal as (string | null)[]).includes(activeId);

    if (overId === RETURN_DROP_ZONE_ID) {
      if (!alreadyInProposal) {
        playDropInvalid();
        return;
      }
      if (activeId !== meId) {
        playDropInvalid();
        notify({ title: "自分のカードだけ戻せます", type: "info", duration: 1200 });
        return;
      }
      updatePendingState((prev) => prev.filter((id) => id !== activeId));
      try {
        await removeCardFromProposal(roomId, activeId);
        playCardPlace();
        notify({ title: "カードを戻しました", type: "info", duration: 900 });
      } catch (error) {
        logError("central-card-board", "remove-card-from-proposal", error);
        playDropInvalid();
        notify({
          title: "カードを戻せませんでした",
          type: "error",
          duration: 1200,
        });
      }
      return;
    }

    if (overId.startsWith("slot-")) {
      let slotIndex = parseInt(overId.split("-")[1]);
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
        if (!alreadyInProposal) {
          updatePendingState((prev) => {
            const next = [...prev];
            const exist = next.indexOf(activeId);
            if (exist >= 0) next.splice(exist, 1);
            if (slotIndex >= next.length) {
              next.length = slotIndex + 1;
            }
            next[slotIndex] = activeId;
            return next;
          });
        }
        try {
          if (alreadyInProposal) {
            await moveCardInProposalToPosition(roomId, activeId, slotIndex);
          } else {
            await addCardToProposalAtPosition(roomId, activeId, slotIndex);
          }
          playCardPlace();
          return;
        } catch (error) {
          logError("central-card-board", "add-card-to-proposal", error);
          playDropInvalid();
          return;
        }
      }
    }

    if (alreadyInProposal) {
      const targetIndex = (activeProposal as (string | null)[]).indexOf(overId);
      if (targetIndex < 0) {
        playDropInvalid();
        return;
      }
      try {
        await moveCardInProposalToPosition(roomId, activeId, targetIndex);
        playCardPlace();
      } catch {
        playDropInvalid();
      }
    }
  }, [
    resolveMode,
    roomStatus,
    playDropInvalid,
    playCardPlace,
    activeProposal,
    meId,
    updatePendingState,
    roomId,
    slotCountDragging,
    clearActive,
  ]);
  const isDraggingOwnPlacedCard =
    activeId === meId && (activeProposal as (string | null)[]).includes(activeId);

  // ????: sort-submit ? "reveal" ??????????????????????????
  // ??????????? finalizeReveal ????
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (resolveMode === "sort-submit" && roomStatus === "reveal") {
      const n = (orderList || []).length;
      if (n > 0) {
        const total =
          REVEAL_FIRST_DELAY +
          Math.max(0, n - 1) * REVEAL_STEP_DELAY +
          REVEAL_LINGER +
          200; // safety margin
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
    // ??????????????
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, [roomStatus, resolveMode, orderList?.length, roomId]);

  // Sort-submit mode only - no sequential finalize needed

  // sort-submit: ???????????
  const proposedCount = Array.isArray(proposal)
    ? (proposal as (string | null)[]).filter(Boolean).length
    : 0;
  const proposalLength = slotCountDragging;
  const canConfirm =
    resolveMode === "sort-submit" &&
    roomStatus === "clue" &&
    proposedCount === proposalLength &&
    proposalLength > 0 &&
    !!isHost;
  // ⚡ PERFORMANCE: onConfirm をuseCallback化
  const onConfirm = useCallback(async () => {
    if (!canConfirm) return;
    try {
      await submitSortedOrder(
        roomId,
        (proposal as (string | null)[]).filter(Boolean) as string[]
      );
    } catch {}
  }, [canConfirm, roomId, proposal]);

  return (
    <Box
      data-board-root
      h="100%"
      display="flex"
      flexDirection="column"
      border="none"
      borderWidth="0"
      css={{
        // ????????????
        background: "transparent",
        position: "relative",
      }}
    >
      {/* A11y: reveal??????????? */}
      <VisuallyHidden aria-live="polite">
        {roomStatus === "reveal"
          ? `??? ${revealIndex} / ${(orderList || []).length}`
          : roomStatus === "finished"
          ? realtimeResult?.failedAt
            ? `??: ???${realtimeResult.failedAt}??????`
            : `??: ??`
          : ""}
      </VisuallyHidden>
      {/* ????????? - DPI125%?? */}
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
      ></Box>

      {/* === 2025? DPI?? 8?????? ?????? === */}
      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="flex-start"
        overflow="visible"
        position="relative"
        minHeight={0}
        // ????????????????????????????????
        // ??????????????: ??????????????40?45%??
        // vh????????/DPI????????????
        pt={{ base: "12vh", md: "14vh" }}
        pb={{ base: 4, md: 6 }}
        css={{
          // 150DPI?????: ?????
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
            paddingTop: "14vh !important",
            paddingBottom: "1rem !important",
          },
        }}
      >
        {/* DndContext scope expanded to include WaitingArea for drag functionality */}
        {resolveMode === "sort-submit" && roomStatus === "clue" ? (
          <DndContext
            collisionDetection={collisionDetection}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={clearActive}
            sensors={sensors}
            modifiers={[restrictToFirstScrollableAncestor]}
            accessibility={{
              announcements: {
                onDragStart: ({ active }) => {
                  const player = playerMap.get(active.id as string);
                  return `????${player?.name || active.id}??????????????`;
                },
                onDragOver: ({ active, over }) => {
                  if (over) {
                    const activePlayer = playerMap.get(active.id as string);
                    const overIndex = activeProposal.indexOf(over.id as string);
                    return `????${activePlayer?.name || active.id}????${overIndex + 1}???????`;
                  }
                  return `????${active.id}????????`;
                },
                onDragEnd: ({ active, over }) => {
                  const activePlayer = playerMap.get(active.id as string);
                  if (over) {
                    const overIndex = activeProposal.indexOf(over.id as string);
                    return `????${activePlayer?.name || active.id}????${overIndex + 1}????????`;
                  }
                  return `????${activePlayer?.name || active.id}??????????????`;
                },
                onDragCancel: ({ active }) => {
                  const activePlayer = playerMap.get(active.id as string);
                  return `????${activePlayer?.name || active.id}?????????????????`;
                },
              },
            }}
          >
            {/* Card Board Area */}
            <Box
              borderWidth="0"
              border="borders.retrogameThin"
              borderColor={UI_TOKENS.COLORS.whiteAlpha90}
              borderRadius={0}
              padding={{ base: 3, md: 4 }} // DPI100%??????????
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
              transition="background-color 0.28s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.28s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.28s cubic-bezier(0.4, 0, 0.2, 1)" // AI感除去: 0.3s → 0.28s
              data-drop-target={isOver && canDrop ? "true" : "false"}
              css={{
                containerType: "inline-size",
                // ?????????????????
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                  gap: "8px", // DPI125%????
                  padding: "8px 12px",
                  // ?????????
                  "& > *": {
                    minWidth: UNIFIED_LAYOUT.DPI_125.CARD.WIDTH.base,
                  },
                },
                // DPI 150%?????????????????@layer???CSS???????
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
                  gap: `${UNIFIED_LAYOUT.DPI_150.SPACING.CARD_GAP} !important`, // ?????18px
                  rowGap: `${UNIFIED_LAYOUT.DPI_150.SPACING.ROW_GAP} !important`, // ?????28px???????
                  padding: `${UNIFIED_LAYOUT.DPI_150.SPACING.COMPONENT_PADDING} !important`, // 10px
                  minHeight: "auto !important",
                  alignContent: "flex-start !important", // ????????
                  // ????????
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
                // ??????????????
                "@container (max-width: 600px)": {
                  gap: "6px",
                  padding: "8px",
                },
              }}
            >
              <Box width="100%" css={{ display: "contents" }}>
                <SortableContext
                  items={
                    (activeProposal as (string | null)[]).filter(
                      Boolean
                    ) as string[]
                  }
                >
                  {/* Empty slots for placement */}
                  {Array.from({ length: Math.max(0, slotCountDragging) }).map(
                    (_, idx) => {
                      // Prefer proposal value, but fall back to locally optimistic
                      // `pending` so the UI doesn't temporarily show an empty
                      // slot if `proposal` briefly mutates.
                      const ap = activeProposal[idx] as any;
                      const cardId =
                        (ap ?? null) || (pending && pending[idx]) || null;
                      const ready = cardId
                        ? !!(
                            playerMap.get(cardId)?.clue1 &&
                            playerMap.get(cardId)!.clue1.trim() !== ""
                          )
                        : false;
                      if (cardId && ready) {
                        // proposal ???? sortable?pending ???????????????
                        return ap ? (
                          <SortableItem id={cardId} key={cardId}>
                            {renderCard(cardId, idx)}
                          </SortableItem>
                        ) : (
                          <React.Fragment key={`ghost-${idx}-${cardId}`}>
                            {renderCard(cardId, idx)}
                          </React.Fragment>
                        );
                      }
                      // Empty slot placeholder - show during clue phase with droppable ID
                      return (
                        <EmptyCard
                          key={`slot-${idx}`}
                          slotNumber={idx + 1}
                          totalSlots={slotCountDragging}
                          alignSelf="flex-start"
                          id={`slot-${idx}`}
                          isDroppable={true}
                          isDragActive={!!activeId}
                        />
                      );
                    }
                  )}
                </SortableContext>
              </Box>
            </Box>

            {/* DragOverlay: ????????????????????????????100%????? */}
            <DragOverlay
              dropAnimation={{ duration: 200, easing: UI_TOKENS.EASING.standard }}
              modifiers={[restrictToWindowEdges]}
            >
              {activeId
                ? (() => {
                  const idx = (activeProposal as (string | null)[]).indexOf(
                    activeId
                  );
                    const ghostStyle = {
                      transform: "scale(1.05)",
                      filter: UI_TOKENS.FILTERS.dropShadowStrong,
                      opacity: 0.98,
                    } as React.CSSProperties;
                    
                    if (idx >= 0) {
                      return (
                        <div style={ghostStyle}>
                          {renderCard(activeId, idx)}
                        </div>
                      );
                    }
                    // ??????????????????????
                    return (
                      <div style={ghostStyle}>
                        {renderCard(activeId)}
                      </div>
                    );
                  })()
                : null}
            </DragOverlay>

            {/* ??????clue/waiting????????????- DndContext???? */}
            {(roomStatus === "clue" || roomStatus === "waiting") && (
              <Box
                width="100%"
                maxWidth="var(--board-max-width)"
                marginInline="auto"
                mt={{ base: 6, md: 8 }}
                css={{
                  // 150DPI??: ??????????
                  [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
                    marginTop: "1rem !important",
                  },
                }}
              >
                <WaitingArea
                  players={waitingPlayers}
                  isDraggingEnabled={true}
                  meId={meId}
                  displayMode={displayMode}
                  returnDropZoneId={RETURN_DROP_ZONE_ID}
                  hideClues={roomStatus !== "clue"}
                />
              </Box>
            )}
          </DndContext>
        ) : (
          <>
            {/* Static game state without DndContext */}
            <Box
              borderWidth="0"
              border="borders.retrogameThin"
              borderColor={UI_TOKENS.COLORS.whiteAlpha90}
              borderRadius={0}
              padding={{ base: 3, md: 4 }} // DPI100%??????????
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
              transition="background-color 0.28s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.28s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.28s cubic-bezier(0.4, 0, 0.2, 1)" // AI感除去: 0.3s → 0.28s
              data-drop-target={isOver && canDrop ? "true" : "false"}
              css={{
                containerType: "inline-size",
                // ?????????????????
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                  gap: "8px", // DPI125%????
                  padding: "8px 12px",
                  // ?????????
                  "& > *": {
                    minWidth: UNIFIED_LAYOUT.DPI_125.CARD.WIDTH.base,
                  },
                },
                // DPI 150%?????????????????@layer???CSS???????
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
                  gap: `${UNIFIED_LAYOUT.DPI_150.SPACING.CARD_GAP} !important`, // ?????18px
                  rowGap: `${UNIFIED_LAYOUT.DPI_150.SPACING.ROW_GAP} !important`, // ?????28px???????
                  padding: `${UNIFIED_LAYOUT.DPI_150.SPACING.COMPONENT_PADDING} !important`, // 10px
                  minHeight: "auto !important",
                  alignContent: "flex-start !important", // ????????
                  // ????????
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
                // ??????????????
                "@container (max-width: 600px)": {
                  gap: "6px",
                  padding: "8px",
                },
              }}
            >
              <Box width="100%" css={{ display: "contents" }}>
                {/* Static game state */}
                {Array.from({ length: Math.max(0, slotCountStatic) }).map(
                  (_, idx) => {
                    // Prefer confirmed orderList entry; fall back to locally pending
                    // placement so the first card appears immediately in the slot
                    // even before server-side orderList updates arrive.
                    const ap = activeProposal[idx] as any;
                    const cardId =
                      (ap ?? null) ||
                      orderList?.[idx] ||
                      (pending && pending[idx]) ||
                      null;
                    const isDroppableSlot = canDropAtPosition(idx);
                    // ?????????????
                    const isGameActive =
                      roomStatus === "clue" ||
                      roomStatus === "reveal" ||
                      roomStatus === "finished";

                    // ????????????????????????????
                    const ready = cardId
                      ? !!(
                          playerMap.get(cardId)?.clue1 &&
                          playerMap.get(cardId)!.clue1.trim() !== ""
                        )
                      : false;
                    return cardId && ready && isGameActive ? (
                      <React.Fragment key={cardId ?? `slot-${idx}`}>
                        {renderCard(cardId, idx)}
                      </React.Fragment>
                    ) : isDroppableSlot ? (
                      <EmptyCard
                        key={`drop-zone-${idx}`}
                        slotNumber={idx + 1}
                        totalSlots={slotCountStatic}
                        isDroppable={isDroppableSlot}
                        onDragOver={(e) => {
                          if (isDroppableSlot && !isOver) {
                            setIsOver(true);
                          }
                        }}
                        onDragLeave={() => {
                          setIsOver(false);
                        }}
                        onDrop={(e) => onDropAtPosition(e, idx)}
                        alignSelf="flex-start"
                        _focusVisible={{
                          outline: "2px solid",
                          outlineColor: "focusRing",
                          outlineOffset: 2,
                        }}
                        tabIndex={0}
                      />
                    ) : (
                      <Tooltip
                        key={`drop-zone-${idx}`}
                        content="このスロットはまだ使用できません"
                        openDelay={300}
                        showArrow
                      >
                        <Box display="inline-flex">
                          <EmptyCard
                            slotNumber={idx + 1}
                            totalSlots={slotCountStatic}
                            isDroppable={false}
                            onDragOver={() => {}}
                            onDragLeave={() => setIsOver(false)}
                            onDrop={() => {}}
                            alignSelf="flex-start"
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
                  }
                )}

                {/* No pending cards needed in sort-submit mode */}
              </Box>
            </Box>

            {/* ??????clue/waiting????????????- Static mode */}
            {(roomStatus === "clue" || roomStatus === "waiting") &&
              waitingPlayers.length > 0 && (
                <Box
                  width="100%"
                  maxWidth="var(--board-max-width)"
                  marginInline="auto"
                  mt={{ base: 6, md: 8 }}
                  css={{
                    // 150DPI??: ??????????
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
                  />
                </Box>
              )}
          </>
        )}

      </Box>

      {/* GSAP?????????????????????? */}
      {roomStatus === "finished" && (
        <GameResultOverlay failed={failed} mode="overlay" />
      )}
      <MvpLedger
        isOpen={isLedgerOpen}
        onClose={() => setLedgerOpen(false)}
        players={players}
        orderList={orderList}
        topic={topic}
        failed={failed}
      />
    </Box>
  );
};

export default CentralCardBoard;

