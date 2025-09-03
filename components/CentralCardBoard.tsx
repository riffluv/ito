"use client";
import { useDropHandler } from "@/components/hooks/useDropHandler";
import { useLocalFailureDetection } from "@/components/hooks/useLocalFailureDetection";
import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import { SortableItem } from "@/components/sortable/SortableItem";
import ArtifactResultOverlay from "@/components/ui/ArtifactResultOverlay";
import { CardRenderer } from "@/components/ui/CardRenderer";
import { GameResultOverlay } from "@/components/ui/GameResultOverlay";
import StatusDock from "@/components/ui/StatusDock";
import WaitingArea from "@/components/ui/WaitingArea";
import {
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
  // 1-based failure index; null = no failure yet. Accept explicit null to match Firestore schema.
  failedAt: number | null | undefined;
  proposal?: string[];
  resolveMode?: string;
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
  failedAt,
  proposal,
  resolveMode = "sort-submit",
  isHost,
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

  const { revealAnimating, revealIndex } = useRevealAnimation({
    roomId,
    roomStatus,
    resolveMode,
    orderListLength: orderList?.length || 0,
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
    resolveMode,
    cluesReady,
    orderList,
    proposal,
    hasNumber,
    mePlaced,
  });

  const { localFailedAt, boundaryPreviousIndex } = useLocalFailureDetection({
    currentPlaced,
    players: players as any,
    resolveMode,
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
      failedAt={failedAt}
      localFailedAt={localFailedAt}
      boundaryPreviousIndex={boundaryPreviousIndex}
    />
  );

  // DnD sorting for sort-submit mode
  const activeProposal = useMemo(() => {
    // During finished phase, use confirmed orderList instead of proposal
    if (roomStatus === "finished") {
      return orderList || [];
    }
    return proposal || [];
  }, [proposal?.join(","), orderList?.join(","), roomStatus]);
  const onDragEnd = async (e: DragEndEvent) => {
    if (resolveMode !== "sort-submit" || roomStatus !== "clue") return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = activeProposal.indexOf(String(active.id));
    const newIndex = activeProposal.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(activeProposal, oldIndex, newIndex);
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
        // 🎮 PREMIUM BOARD CONTAINER
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
      >
        {/* 🎯 PREMIUM INSTRUCTION - Professional Game Guidance */}
        <Box
          bg="cardInstruction"
          border="1px solid"
          borderColor="cardInstructionBorder"
          borderRadius="xl"
          px={{ base: 4, md: 6 }}
          py={{ base: 3, md: 4 }}
          backdropFilter="blur(16px)"
          boxShadow="sm"
          transition="all 0.2s ease"
          display="inline-block"
          fontFamily="heading"
          fontSize="sm"
          fontWeight="500"
          color="cardInstructionText"
          letterSpacing="-0.01em"
          _hover={{
            bg: "cardInstructionHover",
            borderColor: "cardInstructionBorderHover",
            transform: "translateY(-1px)",
            boxShadow: "md",
          }}
        >
          小さい順から大きい順に並べよう
        </Box>
      </Box>

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
        <Box
          borderWidth="0"
          borderRadius="2xl"
          padding={{ base: 4, md: 6 }}
          minHeight="auto"
          width="100%"
          maxWidth="var(--board-max-width)"
          marginInline="auto"
          display="flex"
          flexWrap="wrap"
          justifyContent="center"
          alignContent="flex-start"
          alignItems="flex-start"
          gap={{ base: 3, md: 4, lg: 5 }} // 8人環境で適切なスペーシング
          bg="transparent"
          boxShadow="none"
          transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          data-drop-target={isOver && canDrop ? "true" : "false"}
          // 8人環境での最適化統合CSS
          css={{
            containerType: "inline-size",
            // 8人環境でのレスポンシブ最適化
            "@media (max-width: 1200px)": {
              gap: "0.75rem",
              flexWrap: "wrap",
              justifyContent: "space-evenly", // 8人でも均等配置
            },
            "@media (max-width: 768px)": {
              gap: "0.5rem",
              padding: "0.75rem",
            },
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
              gap: "calc(var(--spacing-2) + 2px)",
              padding: "0.6rem 0.9rem",
            },
          }}
        >
          <Box
            onDragOver={(e) => {
              e.preventDefault();
              if (canDrop) {
                setIsOver(true);
              }
            }}
            onDragLeave={() => setIsOver(false)}
            onDrop={onDrop}
            width="100%"
            css={{ display: "contents" }}
          >
            {/* Drop Slots and Cards */}
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
                        const overIndex = activeProposal.indexOf(
                          over.id as string
                        );
                        return `カード「${activePlayer?.name || active.id}」を位置${overIndex + 1}に移動中です。`;
                      }
                      return `カード「${active.id}」を移動中です。`;
                    },
                    onDragEnd: ({ active, over }) => {
                      const activePlayer = playerMap.get(active.id as string);
                      if (over) {
                        const overIndex = activeProposal.indexOf(
                          over.id as string
                        );
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
                <SortableContext items={activeProposal}>
                  {/* Empty slots for placement - optimized for 8+ players */}
                  {Array.from({ length: Math.max(eligibleIds.length, players.length) }).map((_, idx) => {
                    // Prefer proposal value, but fall back to locally optimistic
                    // `pending` so the UI doesn't temporarily show an empty
                    // slot if `proposal` briefly mutates.
                    const cardId =
                      activeProposal[idx] ?? (pending && pending[idx]) ?? null;
                    if (cardId) {
                      return (
                        <SortableItem id={cardId} key={cardId}>
                          {renderCard(cardId, idx)}
                        </SortableItem>
                      );
                    }
                    // Empty slot placeholder - show during clue phase
                    return (
                      <Box
                        key={`slot-${idx}`}
                        data-slot
                        aspectRatio="5/7"
                        width="120px"
                        alignSelf="flex-start"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        bg="surfaceRaised"
                        border="1.5px dashed"
                        borderColor="slotBorder"
                        borderRadius="lg"
                        boxShadow="sm"
                        backdropFilter="blur(4px)"
                        fontSize="lg"
                        fontWeight="500"
                        color="slotText"
                        letterSpacing="-0.01em"
                        transition="all 0.3s ease"
                        cursor="pointer"
                        position="relative"
                        overflow="hidden"
                        _hover={{
                          bg: "slotHover",
                          borderColor: "slotBorderHover",
                          color: "slotTextHover",
                          transform: "translateY(-2px)",
                          boxShadow: "md",
                        }}
                      >
                        {idx + 1}
                      </Box>
                    );
                  })}
                </SortableContext>
              </DndContext>
            ) : (
              <>
                {/* Static game state: use eligible slots count - optimized */}
                {Array.from({ 
                  length: Math.max(eligibleIds.length, players.length) 
                })
                  .map((_, idx) => {
                    // Prefer confirmed orderList entry; fall back to locally pending
                    // placement so the first card appears immediately in the slot
                    // even before server-side orderList updates arrive.
                    const cardId =
                      orderList?.[idx] ?? (pending && pending[idx]) ?? null;
                    const isDroppableSlot = canDropAtPosition(idx);
                    // Sort-submit mode: show cards during all relevant phases
                    const shouldShowCard =
                      cardId &&
                      (roomStatus === "clue" ||
                        roomStatus === "playing" ||
                        roomStatus === "reveal" ||
                        roomStatus === "finished");
                    return shouldShowCard ? (
                      <React.Fragment key={cardId ?? `slot-${idx}`}>
                        {cardId ? renderCard(cardId, idx) : null}
                      </React.Fragment>
                    ) : (
                      <Box
                        key={`drop-zone-${idx}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isDroppableSlot && !isOver) {
                            setIsOver(true);
                          }
                        }}
                        onDragLeave={(e) => {
                          e.stopPropagation();
                          // 子要素への移動ではリセットしない
                          if (
                            !e.currentTarget.contains(e.relatedTarget as Node)
                          ) {
                            setIsOver(false);
                          }
                        }}
                        onDrop={(e) => onDropAtPosition(e, idx)}
                        borderWidth="0"
                        borderRadius="xl"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        bg={isDroppableSlot ? "slotDrop" : "surfaceRaised"}
                        color={isDroppableSlot ? "slotDropText" : "fgMuted"}
                        fontSize="lg"
                        fontWeight="600"
                        // Consistent white dashed border for all slots
                        border="1.5px dashed"
                        borderColor="slotBorder"
                        boxShadow="sm"
                        transition="all 0.2s ease"
                        cursor={isDroppableSlot ? "copy" : "not-allowed"}
                        _hover={
                          isDroppableSlot
                            ? {
                                bg: "slotHover",
                                borderColor: "slotBorderHover",
                                color: "slotTextHover",
                                transform: "translateY(-2px)",
                                boxShadow: "md",
                              }
                            : {}
                        }
                        css={{ aspectRatio: "5 / 7" }}
                        alignSelf="flex-start"
                        width="120px"
                      >
                        {idx + 1}
                      </Box>
                    );
                  })}

                {/* No pending cards needed in sort-submit mode */}
              </>
            )}
          </Box>
        </Box>

        <StatusDock
          show={roomStatus === "finished"}
          data-finished={roomStatus === "finished"}
        >
          {roomStatus === "finished" && (
            <GameResultOverlay
              failed={failed}
              failedAt={failedAt}
              mode="inline"
            />
          )}
        </StatusDock>
      </Box>
      {/* 待機エリア（clue/waiting中・未提出者がいる場合） */}
      {(roomStatus === "clue" || roomStatus === "waiting") &&
      waitingPlayers.length > 0 ? (
        <WaitingArea players={waitingPlayers} />
      ) : null}
      {/* 確定ドック（未提出者がいなくなったら、同じ場所に出す） - DISABLED: 重複機能のため削除 */}
      {/* {canConfirm && waitingPlayers.length === 0 ? (
        <ConfirmDock onConfirm={onConfirm} label="並びを確定" />
      ) : null} */}
      {/* 結果オーバーレイ（モック準拠の演出） */}
      {roomStatus === "finished" && showResult && (
        <ArtifactResultOverlay
          success={!failed}
          onClose={() => setShowResult(false)}
        />
      )}
    </Box>
  );
};

export default CentralCardBoard;
