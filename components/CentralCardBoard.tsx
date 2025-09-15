"use client";
import { useDropHandler } from "@/components/hooks/useDropHandler";
import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import { SortableItem } from "@/components/sortable/SortableItem";
import { CardRenderer } from "@/components/ui/CardRenderer";
import { GameResultOverlay } from "@/components/ui/GameResultOverlay";
import WaitingArea from "@/components/ui/WaitingArea";
import {
  addCardToProposalAtPosition,
  finalizeReveal,
  moveCardInProposalToPosition,
  submitSortedOrder,
} from "@/lib/game/room";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import type { ResolveMode } from "@/lib/game/resolveMode";
import { Box } from "@chakra-ui/react";
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
import React, { useEffect, useMemo, useRef, useState } from "react";
// Layout & animation constants sourced from theme/layout and existing motion logic
import { EmptyCard } from "@/components/cards";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
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
  displayMode?: "full" | "minimal"; // カード表示モード
  // 親からスロット数を明示指定する場合に使用（サーバ/親と厳密一致）
  slotCount?: number;
}

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
}) => {
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

  // Optimize waiting players calculation for 8+ players
  const waitingPlayers = useMemo(() => {
    return (eligibleIds || [])
      .map((id) => playerMap.get(id)!)
      .filter((p) => p && !placedIds.has(p.id));
  }, [eligibleIds, playerMap, placedIds]);

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

  // Collision detection: stricter distance-based detection to prevent accidental drops
  const collisionDetection: CollisionDetection = (args) => {
    const { active, collisionRect, droppableRects } = args;
    
    if (!active || !collisionRect) return [];
    
    // Calculate center of dragging item
    const dragCenter = {
      x: collisionRect.left + collisionRect.width / 2,
      y: collisionRect.top + collisionRect.height / 2,
    };
    
    const candidates = [];
    
    for (const [droppableId, rect] of droppableRects.entries()) {
      // Calculate center of drop zone
      const dropCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      
      // Calculate distance between centers
      const distance = Math.sqrt(
        Math.pow(dragCenter.x - dropCenter.x, 2) +
        Math.pow(dragCenter.y - dropCenter.y, 2)
      );
      
      // Only accept drop if drag center is within 60px of drop center
      // This prevents accidental drops when just slightly moving upward
      const threshold = 60; // pixels
      
      if (distance <= threshold) {
        candidates.push({
          id: droppableId,
          data: { value: distance }
        });
      }
    }
    
    // Sort by distance and return closest valid drop zone
    return candidates.sort((a, b) => (a.data?.value as number) - (b.data?.value as number));
  };

  // Optimize mePlaced calculation using Set for O(1) lookup instead of O(n) includes
  const mePlaced = useMemo(() => {
    return placedIds.has(meId);
  }, [placedIds, meId]);

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

  // sequential 用の reveal hook は pending 情報も考慮した枚数を渡したいので
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

  // 結果オーバーレイの表示・自動クローズ
  const [showResult, setShowResult] = useState(false);
  useEffect(() => {
    if (roomStatus === "finished") {
      const appear = setTimeout(() => setShowResult(true), REVEAL_LINGER); // 余韻後に演出
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

  // Clear pending when orderList updates - optimized Set lookup for 8+ players
  const orderListSet = useMemo(
    () => new Set(orderList || []),
    [orderList?.join(",")]
  );
  useEffect(() => {
    if (!orderList || orderList.length === 0) return;
    setPending((cur) => cur.filter((id) => !orderListSet.has(id)));
  }, [orderListSet, setPending]);

  // proposal 反映時に proposal 上に存在するIDの pending ゴーストを掃除
  useEffect(() => {
    if (!proposal || proposal.length === 0) return;
    const present = new Set(
      (proposal as (string | null)[]).filter(Boolean) as string[]
    );
    setPending((cur) => cur.filter((id) => !present.has(id)));
  }, [proposal?.join(","), setPending]);

  // 背景タブ/非表示化時はローカルの pending をクリアしてチラつきを抑止
  useEffect(() => {
    const onVis = () => {
      try {
        if (document.visibilityState === "hidden") {
          setPending([]);
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
  }, [setPending]);

  const renderCard = (id: string, idx?: number) => (
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
      // sort-submit ではサーバ駆動の revealIndex、順次ではローカル progressive index
      revealIndex={revealIndex}
      revealAnimating={revealAnimating}
      failed={failed}
      boundaryPreviousIndex={
        realtimeResult?.failedAt && typeof realtimeResult.failedAt === "number"
          ? realtimeResult.failedAt - 2
          : null
      }
      realtimeResult={realtimeResult} // リアルタイム判定結果を追加
    />
  );

  // DnD sorting for sort-submit mode
  const activeProposal = useMemo(() => {
    // finished時は確定順のみ
    if (roomStatus === "finished") return orderList || [];
    // 提案配列は null を空きとして保持（サーバー側でnullパディングするため）
    return (proposal ?? []) as (string | null)[];
  }, [proposal?.join(","), orderList?.join(","), roomStatus]);

  // 親から明示されたスロット数（優先）にフォールバック（dragging/static共通）
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

  const onDragEnd = async (e: DragEndEvent) => {
    if (resolveMode !== "sort-submit" || roomStatus !== "clue") return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    // Check if this is a WaitingCard being dropped to an empty slot
    const activeId = String(active.id);
    const overId = String(over.id);
    const alreadyInProposal = (activeProposal as (string | null)[]).includes(
      activeId
    );

    // Handle WaitingCard -> EmptySlot drops
    if (overId.startsWith("slot-")) {
      let slotIndex = parseInt(overId.split("-")[1]);
      if (!isNaN(slotIndex)) {
        const maxSlots = Math.max(0, (eligibleIds?.length || 0) - 1);
        slotIndex = Math.min(Math.max(0, slotIndex), maxSlots);
        // Optimistic: 待機→新規配置のときのみ pending を更新。既存カードの移動では pending を触らない
        if (!alreadyInProposal) {
          setPending((prev) => {
            const next = [...prev];
            // remove if already exists elsewhere
            const exist = next.indexOf(activeId);
            if (exist >= 0) next.splice(exist, 1);
            // ensure length
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
          return;
        } catch (error) {
          console.error("Failed to add card to proposal at position:", error);
          return;
        }
      }
    }

    // Handle card-on-card reordering within proposal using fixed-length (null-padded) indices
    // Only allow if the active card is already on the board. Waiting cards must drop onto empty slots.
    if (alreadyInProposal) {
      const targetIndex = (activeProposal as (string | null)[]).indexOf(overId);
      if (targetIndex < 0) return;
      try {
        await moveCardInProposalToPosition(roomId, activeId, targetIndex);
      } catch {
        /* ignore */
      }
    }
  };

  // DragOverlay 用のアクティブID管理
  const [activeId, setActiveId] = useState<string | null>(null);
  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };
  const clearActive = () => setActiveId(null);

  // 安全装置: sort-submit で "reveal" に入ったが何らかの理由でアニメ完了検知が漏れた場合、
  // 理論上の総所要時間後に finalizeReveal を呼ぶ。
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
    // 状態が変わったらタイマー破棄
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, [roomStatus, resolveMode, orderList?.length, roomId]);

  // Sort-submit mode only - no sequential finalize needed

  // sort-submit: 全員提出で「確定」可能
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
  const onConfirm = async () => {
    if (!canConfirm) return;
    try {
      await submitSortedOrder(
        roomId,
        (proposal as (string | null)[]).filter(Boolean) as string[]
      );
    } catch {}
  };

  return (
    <Box
      data-board-root
      h="100%"
      display="flex"
      flexDirection="column"
      border="none"
      borderWidth="0"
      css={{
        // 背景なしでクリーンな表示
        background: "transparent",
        position: "relative",
      }}
    >
      {/* コンパクトヘッダー - DPI125%対応 */}
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

      {/* === 2025年 DPI対応 8人環境最適化 カードボード === */}
      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="flex-start"
        overflow="visible"
        position="relative"
        minHeight={0}
        // 盤面上部に十分な呼吸域を確保（中央お題パネルを廃止したため調整）
        // モダンカードゲームの視線設計: 盤面の重心は画面中央やや下（40–45%）。
        // vh基準にして解像度/DPIに依存しない位置を維持。
        pt={{ base: "12vh", md: "14vh" }}
        pb={{ base: 4, md: 6 }}
        css={{
          // 150DPI専用最適化: 縦方向圧縮
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
            onDragEnd={(ev) => {
              onDragEnd(ev);
              clearActive();
            }}
            onDragCancel={clearActive}
            sensors={sensors}
            modifiers={[restrictToFirstScrollableAncestor]}
            accessibility={{
              announcements: {
                onDragStart: ({ active }) => {
                  const player = playerMap.get(active.id as string);
                  return `カード「${player?.name || active.id}」のドラッグを開始しました。`;
                },
                onDragOver: ({ active, over }) => {
                  if (over) {
                    const activePlayer = playerMap.get(active.id as string);
                    const overIndex = activeProposal.indexOf(over.id as string);
                    return `カード「${activePlayer?.name || active.id}」を位置${overIndex + 1}に移動中です。`;
                  }
                  return `カード「${active.id}」を移動中です。`;
                },
                onDragEnd: ({ active, over }) => {
                  const activePlayer = playerMap.get(active.id as string);
                  if (over) {
                    const overIndex = activeProposal.indexOf(over.id as string);
                    return `カード「${activePlayer?.name || active.id}」を位置${overIndex + 1}に配置しました。`;
                  }
                  return `カード「${activePlayer?.name || active.id}」のドラッグを終了しました。`;
                },
                onDragCancel: ({ active }) => {
                  const activePlayer = playerMap.get(active.id as string);
                  return `カード「${activePlayer?.name || active.id}」のドラッグをキャンセルしました。`;
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
              padding={{ base: 3, md: 4 }} // DPI100%基準でパディング縮小
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
              transition="background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              data-drop-target={isOver && canDrop ? "true" : "false"}
              css={{
                containerType: "inline-size",
                // 統一されたレスポンシブスペーシング
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                  gap: "8px", // DPI125%用最適化
                  padding: "8px 12px",
                  // カード配置の最適化
                  "& > *": {
                    minWidth: UNIFIED_LAYOUT.DPI_125.CARD.WIDTH.base,
                  },
                },
                // DPI 150%対応：カードボードエリアの最適化（@layer除去でCSS適用を確実に）
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
                  gap: `${UNIFIED_LAYOUT.DPI_150.SPACING.CARD_GAP} !important`, // 水平間隔：18px
                  rowGap: `${UNIFIED_LAYOUT.DPI_150.SPACING.ROW_GAP} !important`, // 垂直間隔：28px（重なり防止）
                  padding: `${UNIFIED_LAYOUT.DPI_150.SPACING.COMPONENT_PADDING} !important`, // 10px
                  minHeight: "auto !important",
                  alignContent: "flex-start !important", // 上詰めで安定配置
                  // カードサイズ統一
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
                // コンテナクエリベースの最適化
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
                        // proposal 由来のみ sortable。pending 由来は一時表示（ドラッグ不可）
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

            {/* DragOverlay: ドラッグ中のカードをポータルでレンダリングし、ポインタに100%追従させる */}
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
                    // 盤上未配置（待機エリア）の場合も見た目を統一
                    return (
                      <div style={ghostStyle}>
                        {renderCard(activeId)}
                      </div>
                    );
                  })()
                : null}
            </DragOverlay>

            {/* 待機エリア（clue/waiting中・未提出者がいる場合）- DndContext内に移動 */}
            {waitingPlayers.length > 0 && (
              <Box 
                mt={{ base: 6, md: 8 }}
                css={{
                  // 150DPI専用: カード間隔を大幅圧縮
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
              padding={{ base: 3, md: 4 }} // DPI100%基準でパディング縮小
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
              transition="background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              data-drop-target={isOver && canDrop ? "true" : "false"}
              css={{
                containerType: "inline-size",
                // 統一されたレスポンシブスペーシング
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                  gap: "8px", // DPI125%用最適化
                  padding: "8px 12px",
                  // カード配置の最適化
                  "& > *": {
                    minWidth: UNIFIED_LAYOUT.DPI_125.CARD.WIDTH.base,
                  },
                },
                // DPI 150%対応：カードボードエリアの最適化（@layer除去でCSS適用を確実に）
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
                  gap: `${UNIFIED_LAYOUT.DPI_150.SPACING.CARD_GAP} !important`, // 水平間隔：18px
                  rowGap: `${UNIFIED_LAYOUT.DPI_150.SPACING.ROW_GAP} !important`, // 垂直間隔：28px（重なり防止）
                  padding: `${UNIFIED_LAYOUT.DPI_150.SPACING.COMPONENT_PADDING} !important`, // 10px
                  minHeight: "auto !important",
                  alignContent: "flex-start !important", // 上詰めで安定配置
                  // カードサイズ統一
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
                // コンテナクエリベースの最適化
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
                    // ゲーム状態での表示条件確認
                    const isGameActive =
                      roomStatus === "clue" ||
                      roomStatus === "reveal" ||
                      roomStatus === "finished";

                    // カードがある場合はカード表示、ない場合は空きスロット表示
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
                        content="配札後に有効/この位置には置けません"
                        openDelay={300}
                        showArrow
                      >
                        <Box display="inline-flex">
                          <EmptyCard
                            slotNumber={idx + 1}
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

            {/* 待機エリア（clue/waiting中・未提出者がいる場合）- Static mode */}
            {(roomStatus === "clue" || roomStatus === "waiting") &&
              waitingPlayers.length > 0 && (
                <Box 
                  mt={{ base: 6, md: 8 }}
                  css={{
                    // 150DPI専用: カード間隔を大幅圧縮
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
                  />
                </Box>
              )}
          </>
        )}

      </Box>

      {/* GSAPアニメーション結果オーバーレイ（豪華な演出） */}
      {roomStatus === "finished" && (
        <GameResultOverlay failed={failed} mode="overlay" />
      )}
    </Box>
  );
};

export default CentralCardBoard;
