"use client";
import { SortableItem } from "@/components/sortable/SortableItem";
// BoardArea / Panel は現行レイアウトでは未使用のため import を削除
import { useDropHandler } from "@/components/hooks/useDropHandler";
import { useLocalFailureDetection } from "@/components/hooks/useLocalFailureDetection";
import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import { useSequentialReveal } from "@/components/hooks/useSequentialReveal";
import ArtifactResultOverlay from "@/components/ui/ArtifactResultOverlay";
import { CardRenderer } from "@/components/ui/CardRenderer";
import ConfirmDock from "@/components/ui/ConfirmDock";
import { GameResultOverlay } from "@/components/ui/GameResultOverlay";
import StatusDock from "@/components/ui/StatusDock";
import WaitingArea from "@/components/ui/WaitingArea";
import {
  finalizeReveal,
  setOrderProposal,
  submitSortedOrder,
} from "@/lib/game/room";
import type { PlayerDoc } from "@/lib/types";
import {
  RESULT_VISIBLE_MS,
  REVEAL_FIRST_DELAY,
  REVEAL_LINGER,
  REVEAL_STEP_DELAY,
} from "@/lib/ui/motion";
import { UNIFIED_LAYOUT } from "@/theme/layout";
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

export function CentralCardBoard({
  roomId,
  players,
  orderList,
  meId,
  eligibleIds,
  roomStatus,
  proposal,
  cluesReady,
  failed,
  failedAt,
  resolveMode,
  isHost,
}: {
  roomId: string;
  players: (PlayerDoc & { id: string })[];
  orderList: string[];
  meId: string;
  eligibleIds: string[];
  roomStatus?: string;
  proposal?: string[];
  cluesReady?: boolean;
  failed?: boolean;
  failedAt?: number | null;
  resolveMode?: string;
  isHost?: boolean;
}) {
  const map = new Map(players.map((p) => [p.id, p]));
  const me = map.get(meId);
  const hasNumber = typeof me?.number === "number";
  // 未提出＝まだ上（提出/提案）に出していない人（準備済みでも残す）
  const placedIds = new Set([
    ...(orderList || []),
    ...((proposal || []) as string[]),
  ]);
  const waitingPlayers = (eligibleIds || [])
    .map((id) => map.get(id)!)
    .filter((p) => p && !placedIds.has(p.id));

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

  const mePlaced = useMemo(() => {
    return (orderList || []).includes(meId) || (proposal || []).includes(meId);
  }, [orderList?.join(","), proposal?.join(","), meId]);

  const { revealAnimating, revealIndex } = useRevealAnimation({
    roomId,
    roomStatus,
    resolveMode,
    orderListLength: orderList?.length || 0,
  });

  // Sequential mode progressive flip (optional)
  const sequentialReveal = useSequentialReveal({
    orderListLength: orderList?.length || 0,
    roomStatus,
    resolveMode,
    enabled: resolveMode !== "sort-submit",
  });

  const {
    pending,
    setPending,
    isOver,
    setIsOver,
    canDrop,
    currentPlaced,
    onDrop,
    onDropAtPosition,
    nextSequentialPosition,
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

  const { localFailedAt } = useLocalFailureDetection({
    currentPlaced,
    players,
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

  // Clear pending when orderList updates
  useEffect(() => {
    if (!orderList || orderList.length === 0) return;
    setPending((cur) => cur.filter((id) => !orderList.includes(id)));
  }, [orderList?.join(","), setPending]);

  const renderCard = (id: string, idx?: number) => (
    <CardRenderer
      key={id}
      id={id}
      player={map.get(id)}
      idx={idx}
      orderList={orderList}
      pending={pending}
      proposal={proposal}
      resolveMode={resolveMode}
      roomStatus={roomStatus}
      // sort-submit ではサーバ駆動の revealIndex、順次ではローカル progressive index
      revealIndex={
        resolveMode === "sort-submit"
          ? revealIndex
          : sequentialReveal.revealIndex
      }
      revealAnimating={
        resolveMode === "sort-submit"
          ? revealAnimating
          : sequentialReveal.revealAnimating
      }
      failed={failed}
      failedAt={failedAt}
      localFailedAt={localFailedAt}
    />
  );

  // DnD sorting for sort-submit mode
  const activeProposal = useMemo(() => proposal || [], [proposal?.join(",")]);
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
      h="100%"
      display="flex"
      flexDirection="column"
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
        {/* 🎯 QUIET LUXURY INSTRUCTION - Sophisticated Guidance */}
        <Box
          css={{
            fontWeight: 500,
            fontSize: "0.9375rem",
            lineHeight: 1.4,
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
            letterSpacing: "-0.01em",
            color: "rgba(255,255,255,0.8)",
            padding: "8px 16px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "12px",
            backdropFilter: "blur(4px)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            transition: "all 0.2s ease",
            display: "inline-block",

            "&:hover": {
              background: "rgba(255,255,255,0.05)",
              borderColor: "rgba(255,255,255,0.08)",
              transform: "translateY(-1px)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            },
          }}
        >
          小さい順から大きい順に並べよう
        </Box>
      </Box>

      {/* === 2025年 DPI対応 コンテナクエリベース カードボード === */}
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
          gap={4}
          bg="transparent"
          boxShadow="none"
          transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          data-drop-target={isOver && canDrop ? "true" : "false"}
          css={{
            containerType: "inline-size",
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
                      const player = map.get(active.id as string);
                      return `カード「${player?.name || active.id}」のドラッグを開始しました。`;
                    },
                    onDragOver: ({ active, over }) => {
                      if (over) {
                        const activePlayer = map.get(active.id as string);
                        const overIndex = activeProposal.indexOf(
                          over.id as string
                        );
                        return `カード「${activePlayer?.name || active.id}」を位置${overIndex + 1}に移動中です。`;
                      }
                      return `カード「${active.id}」を移動中です。`;
                    },
                    onDragEnd: ({ active, over }) => {
                      const activePlayer = map.get(active.id as string);
                      if (over) {
                        const overIndex = activeProposal.indexOf(
                          over.id as string
                        );
                        return `カード「${activePlayer?.name || active.id}」を位置${overIndex + 1}に配置しました。`;
                      }
                      return `カード「${activePlayer?.name || active.id}」のドラッグを終了しました。`;
                    },
                    onDragCancel: ({ active }) => {
                      const activePlayer = map.get(active.id as string);
                      return `カード「${activePlayer?.name || active.id}」のドラッグをキャンセルしました。`;
                    },
                  },
                }}
              >
                <SortableContext items={activeProposal}>
                  {/* Empty slots for placement */}
                  {Array.from({ length: eligibleIds.length }).map((_, idx) => {
                    // Prefer proposal value, but fall back to locally optimistic
                    // `pending` so the UI doesn't temporarily show an empty
                    // slot if `proposal` briefly mutates.
                    const cardId =
                      activeProposal[idx] ?? (pending && pending[idx]) ?? null;
                    return cardId ? (
                      <SortableItem id={cardId} key={cardId}>
                        {renderCard(cardId, idx)}
                      </SortableItem>
                    ) : (
                      <Box
                        key={`slot-${idx}`}
                        css={{
                          // === ELEGANT CARD PROPORTIONS ===
                          aspectRatio: "5 / 7",
                          width: UNIFIED_LAYOUT.CARD.WIDTH,
                          placeSelf: "start",

                          // === REFINED LAYOUT ===
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",

                          // === SOPHISTICATED STYLING ===
                          background: "rgba(255,255,255,0.02)",
                          // dashed slot border restored
                          border: "1.5px dashed rgba(255,255,255,0.15)",
                          borderRadius: "16px",

                          // === PREMIUM VISUAL EFFECTS ===
                          boxShadow:
                            "0 1px 3px rgba(0,0,0,0.1), inset 0 0 0 1px rgba(255,255,255,0.03)",
                          backdropFilter: "blur(4px)",

                          // === REFINED TYPOGRAPHY ===
                          fontSize: "1.125rem",
                          fontWeight: 500,
                          fontFamily:
                            '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
                          color: "rgba(255,255,255,0.4)",
                          letterSpacing: "-0.01em",

                          // === SOPHISTICATED INTERACTION ===
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          cursor: "pointer",
                          position: "relative",
                          overflow: "hidden",

                          // === SUBTLE HOVER ENHANCEMENT ===
                          "&:hover": {
                            background: "rgba(255,255,255,0.06)",
                            borderColor: "rgba(255,255,255,0.25)",
                            color: "rgba(255,255,255,0.7)",
                            transform: "translateY(-2px)",
                            boxShadow:
                              "0 4px 12px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.06)",
                          },

                          // === UNDERSTATED DROP TARGET INDICATOR ===
                          '&[data-drop-active="true"]': {
                            background: "rgba(255,255,255,0.08)",
                            borderColor: "rgba(255,255,255,0.3)",
                            borderStyle: "solid",
                            transform: "scale(1.02)",
                            boxShadow:
                              "0 6px 16px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.08)",
                          },
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
                {/* 順次判定モード: 固定スロットレイアウト（orderList使用） */}
                {Array.from({
                  length: Math.min(
                    eligibleIds.length,
                    (orderList?.length || 0) + 1
                  ),
                }).map((_, idx) => {
                  // Prefer confirmed orderList entry; fall back to locally pending
                  // placement so the first card appears immediately in the slot
                  // even before server-side orderList updates arrive.
                  const cardId =
                    orderList?.[idx] ?? (pending && pending[idx]) ?? null;
                  const isDroppableSlot = canDropAtPosition(idx);
                  // 順次モードでは、プレイヤーが場に出したカードは
                  // room.status が 'clue' のままでも即座に表示したい。
                  // したがって 'clue' を許容する。
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
                      bg={isDroppableSlot ? "accentSubtle" : "surfaceRaised"}
                      color={isDroppableSlot ? "accent" : "fgMuted"}
                      fontSize="lg"
                      fontWeight={600}
                      // restore dashed border to indicate drop target
                      border="2px dashed"
                      borderColor={isDroppableSlot ? "accent" : "borderSubtle"}
                      boxShadow="0 2px 8px rgba(0,0,0,0.1)"
                      transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                      cursor={isDroppableSlot ? "copy" : "not-allowed"}
                      _hover={
                        isDroppableSlot
                          ? {
                              bg: "accentSubtle",
                              color: "accent",
                              borderColor: "accent",
                              transform: "translateY(-2px)",
                              boxShadow: "0 8px 24px rgba(255, 122, 26, 0.25)",
                            }
                          : {}
                      }
                      css={{ aspectRatio: "5 / 7", placeSelf: "start" }}
                      width={UNIFIED_LAYOUT.CARD.WIDTH}
                    >
                      {idx + 1}
                    </Box>
                  );
                })}

                {/* Pending cards - 順次判定モード専用 */}
                {resolveMode !== "sort-submit" &&
                pending &&
                pending.length > 0 &&
                roomStatus !== "finished" &&
                roomStatus !== "reveal"
                  ? pending
                      .filter((id) => !(orderList || []).includes(id))
                      .filter((id) => !(proposal || []).includes(id))
                      .map((id) => renderCard(id))
                  : null}
              </>
            )}
          </Box>
        </Box>

        <StatusDock show={roomStatus === "finished"}>
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
      {/* 確定ドック（未提出者がいなくなったら、同じ場所に出す） */}
      {canConfirm && waitingPlayers.length === 0 ? (
        <ConfirmDock onConfirm={onConfirm} label="並びを確定" />
      ) : null}
      {/* 結果オーバーレイ（モック準拠の演出） */}
      {roomStatus === "finished" && showResult && (
        <ArtifactResultOverlay
          success={!failed}
          onClose={() => setShowResult(false)}
        />
      )}
    </Box>
  );
}

export default CentralCardBoard;
