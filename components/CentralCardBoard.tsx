"use client";
import { useDropHandler } from "@/components/hooks/useDropHandler";
import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import { SortableItem } from "@/components/sortable/SortableItem";
import { CardRenderer } from "@/components/ui/CardRenderer";
import { GameResultOverlay } from "@/components/ui/GameResultOverlay";
import StatusDock from "@/components/ui/StatusDock";
import WaitingArea from "@/components/ui/WaitingArea";
import {
  addCardToProposalAtPosition,
  finalizeReveal,
  setOrderProposal,
  submitSortedOrder,
} from "@/lib/game/room";
import type { PlayerDoc } from "@/lib/types";
import { Box } from "@chakra-ui/react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import React, { useEffect, useMemo, useRef, useState } from "react";
// Layout & animation constants sourced from theme/layout and existing motion logic
import { EmptyCard } from "@/components/cards";
import { UNIFIED_LAYOUT } from "@/theme/layout";
// Fallback hard-coded durations (keep in sync with previous logic/motion.ts if exists)
const REVEAL_FIRST_DELAY = 600;
const REVEAL_STEP_DELAY = 650;
const REVEAL_LINGER = 900;
const RESULT_VISIBLE_MS = 3000;

interface CentralCardBoardProps {
  roomId: string;
  players: any[]; // loosen typing (original PlayerDoc may lack id field)
  orderList: string[];
  meId: string;
  eligibleIds: string[];
  roomStatus: string; // union simplified
  cluesReady?: boolean;
  failed: boolean;
  proposal?: string[];
  resolveMode?: string;
  orderNumbers?: Record<string, number | null | undefined>;
  isHost?: boolean;
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
}) => {
  // Build quick lookup map (id -> player) - memoized for 8+ players performance
  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerDoc & { id: string }>();
    players.forEach((p: any) => {
      if (p && (p.id || p.uid)) {
        m.set(p.id || p.uid, { ...(p as any), id: p.id || p.uid });
      }
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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before activating drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Optimize mePlaced calculation using Set for O(1) lookup instead of O(n) includes
  const mePlaced = useMemo(() => {
    return placedIds.has(meId);
  }, [placedIds, meId]);

  const { revealAnimating, revealIndex, realtimeResult } = useRevealAnimation({
    roomId,
    roomStatus,
    resolveMode,
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

  const renderCard = (id: string, idx?: number) => (
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

  const onDragEnd = async (e: DragEndEvent) => {
    if (resolveMode !== "sort-submit" || roomStatus !== "clue") return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    // Check if this is a WaitingCard being dropped to an empty slot
    const activeId = String(active.id);
    const overId = String(over.id);

    // Handle WaitingCard -> EmptySlot drops
    if (overId.startsWith("slot-")) {
      const slotIndex = parseInt(overId.split("-")[1]);
      if (!isNaN(slotIndex)) {
        // Optimistic: place locally at the intended slot immediately
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
        try {
          await addCardToProposalAtPosition(roomId, activeId, slotIndex);
          return;
        } catch (error) {
          console.error("Failed to add card to proposal at position:", error);
          return;
        }
      }
    }

    // Handle card reordering within proposal
    const sortableItems = (activeProposal as (string | null)[]).filter(
      Boolean
    ) as string[];
    const oldIndex = sortableItems.indexOf(activeId);
    const newIndex = sortableItems.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(sortableItems, oldIndex, newIndex);
    try {
      await setOrderProposal(roomId, reordered);
    } catch {
      /* ignore */
    }
  };

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
  const canConfirm =
    resolveMode === "sort-submit" &&
    roomStatus === "clue" &&
    Array.isArray(eligibleIds) &&
    (proposal?.length || 0) === eligibleIds.length &&
    eligibleIds.length > 0 &&
    !!isHost;
  const onConfirm = async () => {
    if (!canConfirm) return;
    try {
      await submitSortedOrder(roomId, proposal || []);
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
        marginBottom={{ base: "1rem", md: "1.25rem" }}
        flex="0 0 auto"
        width="100%"
        maxWidth="var(--board-max-width)"
        marginInline="auto"
        css={{
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            marginBottom: "0.75rem",
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
      >
        {/* DndContext scope expanded to include WaitingArea for drag functionality */}
        {resolveMode === "sort-submit" && roomStatus === "clue" ? (
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            sensors={sensors}
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
              borderColor="#fff"
              borderRadius={0}
              padding={{ base: 4, md: 6 }} // DPI100%基準でパディング縮小
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
                // DPI 150%対応：カードボードエリアの最適化
                "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
                  {
                    gap: "12px !important", // 間隔をやや縮小→収まり改善
                    padding: "4px 8px !important", // さらにコンパクト
                    // カードサイズ統一
                    "& > *": {
                      minWidth: "88px !important",
                      maxWidth: "88px !important",
                    },
                    "@media (min-width: 768px)": {
                      "& > *": {
                        minWidth: "105px !important",
                        maxWidth: "105px !important",
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
                  {/* Empty slots for placement - optimized for 8+ players */}
                  {Array.from({
                    length: Math.max(
                      eligibleIds.length,
                      players.length,
                      activeProposal.length
                    ),
                  }).map((_, idx) => {
                    // Prefer proposal value, but fall back to locally optimistic
                    // `pending` so the UI doesn't temporarily show an empty
                    // slot if `proposal` briefly mutates.
                    const ap = activeProposal[idx] as any;
                    const cardId =
                      (ap ?? null) || (pending && pending[idx]) || null;
                    if (cardId) {
                      return (
                        <SortableItem id={cardId} key={cardId}>
                          {renderCard(cardId, idx)}
                        </SortableItem>
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
                      />
                    );
                  })}
                </SortableContext>
              </Box>
            </Box>

            {/* 待機エリア（clue/waiting中・未提出者がいる場合）- DndContext内に移動 */}
            {waitingPlayers.length > 0 && (
              <WaitingArea players={waitingPlayers} isDraggingEnabled={true} />
            )}
          </DndContext>
        ) : (
          <>
            {/* Static game state without DndContext */}
            <Box
              borderWidth="0"
              border="borders.retrogameThin"
              borderColor="#fff"
              borderRadius={0}
              padding={{ base: 4, md: 6 }} // DPI100%基準でパディング縮小
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
                // DPI 150%対応：カードボードエリアの最適化
                "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
                  {
                    gap: "12px !important", // 間隔をやや縮小→収まり改善
                    padding: "4px 8px !important", // さらにコンパクト
                    // カードサイズ統一
                    "& > *": {
                      minWidth: "88px !important",
                      maxWidth: "88px !important",
                    },
                    "@media (min-width: 768px)": {
                      "& > *": {
                        minWidth: "105px !important",
                        maxWidth: "105px !important",
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
                {/* Static game state: use eligible slots count - optimized */}
                {Array.from({
                  length: Math.max(
                    eligibleIds.length,
                    players.length,
                    activeProposal.length
                  ),
                }).map((_, idx) => {
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
                    roomStatus === "playing" ||
                    roomStatus === "reveal" ||
                    roomStatus === "finished";

                  // カードがある場合はカード表示、ない場合は空きスロット表示
                  return cardId && isGameActive ? (
                    <React.Fragment key={cardId ?? `slot-${idx}`}>
                      {renderCard(cardId, idx)}
                    </React.Fragment>
                  ) : (
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
                  );
                })}

                {/* No pending cards needed in sort-submit mode */}
              </Box>
            </Box>

            {/* 待機エリア（clue/waiting中・未提出者がいる場合）- Static mode */}
            {(roomStatus === "clue" || roomStatus === "waiting") &&
              waitingPlayers.length > 0 && (
                <WaitingArea
                  players={waitingPlayers}
                  isDraggingEnabled={false}
                />
              )}
          </>
        )}

        <StatusDock
          show={roomStatus === "finished"}
          data-finished={roomStatus === "finished"}
        >
          {/* GSAPオーバーレイに置き換えのためインライン表示を削除 */}
        </StatusDock>
      </Box>

      {/* 確定ドック（未提出者がいなくなったら、同じ場所に出す） - DISABLED: 重複機能のため削除 */}
      {/* {canConfirm && waitingPlayers.length === 0 ? (
        <ConfirmDock onConfirm={onConfirm} label="並びを確定" />
      ) : null} */}

      {/* GSAPアニメーション結果オーバーレイ（豪華な演出） */}
      {roomStatus === "finished" && (
        <GameResultOverlay failed={failed} mode="overlay" />
      )}

      {/* 結果オーバーレイ（モック準拠の演出） - GSAPに置き換えのため無効化 */}
      {/* {roomStatus === "finished" && showResult && (
        <ArtifactResultOverlay
          success={realtimeResult ? realtimeResult.success : !failed}
          onClose={() => setShowResult(false)}
        />
      )} */}
    </Box>
  );
};

export default CentralCardBoard;
