"use client";
import { SortableItem } from "@/components/sortable/SortableItem";
// BoardArea / Panel は現行レイアウトでは未使用のため import を削除
import { CardRenderer } from "@/components/ui/CardRenderer";
import { GameResultOverlay } from "@/components/ui/GameResultOverlay";
import ArtifactResultOverlay from "@/components/ui/ArtifactResultOverlay";
import WaitingArea from "@/components/ui/WaitingArea";
import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import { useDropHandler } from "@/components/hooks/useDropHandler";
import { useLocalFailureDetection } from "@/components/hooks/useLocalFailureDetection";
import { setOrderProposal, submitSortedOrder } from "@/lib/game/room";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Button, Text } from "@chakra-ui/react";
import ConfirmDock from "@/components/ui/ConfirmDock";
import StatusDock from "@/components/ui/StatusDock";
import { DndContext, DragEndEvent, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { REVEAL_LINGER, RESULT_VISIBLE_MS } from "@/lib/ui/motion";
import { REVEAL_FIRST_DELAY, REVEAL_STEP_DELAY } from "@/lib/ui/motion";
import { finalizeReveal } from "@/lib/game/room";

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
  const me = map.get(meId as string) as any;
  const hasNumber = typeof (me as any)?.number === "number";
  // 未提出＝まだ上（提出/提案）に出していない人（準備済みでも残す）
  const placedIds = new Set([...(orderList || []), ...((proposal || []) as string[])]);
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
    return (
      (orderList || []).includes(meId) ||
      (proposal || []).includes(meId)
    );
  }, [orderList?.join(","), proposal?.join(","), meId]);

  const { revealAnimating, revealIndex } = useRevealAnimation({
    roomId,
    roomStatus,
    resolveMode,
    orderListLength: orderList?.length || 0,
  });

  const {
    pending,
    setPending,
    isOver,
    setIsOver,
    canDrop,
    currentPlaced,
    onDrop,
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
      const close = setTimeout(() => setShowResult(false), REVEAL_LINGER + RESULT_VISIBLE_MS);
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
      revealIndex={revealIndex}
      revealAnimating={revealAnimating}
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
        const total = REVEAL_FIRST_DELAY + Math.max(0, n - 1) * REVEAL_STEP_DELAY + REVEAL_LINGER + 200; // safety margin
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
    >
      {/* コンパクトヘッダー - DPI125%対応 */}
      <Box textAlign="center" marginBottom={{ base: "0.5rem", md: "0.5rem" }} flex="0 0 auto" width="100%" maxWidth="var(--board-max-width)" marginInline="auto"
        css={{
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            marginBottom: "0.25rem",
          },
        }}
      >
        <Box fontWeight={500} color="fgMuted" fontSize={{ base: "0.75rem", md: "0.875rem" }} lineHeight={1.3}>
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
          bg="transparent"
          border="0"
          borderRadius="1rem"
          padding={{ base: 2, md: 3 }}
          minHeight="auto"
          width="100%"
          maxWidth="var(--board-max-width)"
          marginInline="auto"
          display="flex"
          flexWrap="wrap"
          justifyContent="center"
          alignContent="flex-start"
          alignItems="flex-start"
          gap={2}
          css={{
            containerType: "inline-size",
            "&[data-drop-target='true']": { outline: "2px solid var(--colors-brand-400)" },
            // spacing 1.5 (6px) をトークンで表現
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: { gap: "calc(var(--spacing-3) / 2)" },
          }}
          data-drop-target={isOver && canDrop ? "true" : "false"}
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
                        const overIndex = activeProposal.indexOf(over.id as string);
                        return `カード「${activePlayer?.name || active.id}」を位置${overIndex + 1}に移動中です。`;
                      }
                      return `カード「${active.id}」を移動中です。`;
                    },
                    onDragEnd: ({ active, over }) => {
                      const activePlayer = map.get(active.id as string);
                      if (over) {
                        const overIndex = activeProposal.indexOf(over.id as string);
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
                    const cardId = activeProposal[idx];
                    return cardId ? (
                      <SortableItem id={cardId} key={cardId}>
                        {renderCard(cardId, idx)}
                      </SortableItem>
                    ) : (
                      <Box
                        key={`slot-${idx}`}
                        css={{
                          aspectRatio: "5 / 7",
                          height: "auto",
                          
                          border: "2px dashed rgba(255,215,0,0.4)",
                          borderRadius: "1rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "rgba(30,15,50,0.3)",
                          color: "rgba(255,215,0,0.6)",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          
                          // Grid アイテムとしての設定
                          placeSelf: "start", // Grid内で上揃え
                        }}
                        width={UNIFIED_LAYOUT.CARD.WIDTH}
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
                {Array.from({ length: eligibleIds.length }).map((_, idx) => {
                  const cardId = orderList?.[idx];
                  return cardId ? (
                    <React.Fragment key={cardId}>
                      {renderCard(cardId, idx)}
                    </React.Fragment>
                  ) : (
                    <Box
                      key={`drop-zone-${idx}`}
                      css={{
                        aspectRatio: "5 / 7",
                        height: "auto",
                        
                        border: "2px dashed rgba(255,215,0,0.4)",
                        borderRadius: "1rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(30,15,50,0.3)",
                        color: "rgba(255,215,0,0.6)",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        
                        // Grid アイテムとしての設定
                        placeSelf: "start", // Grid内で上揃え
                      }}
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

          {/* 旧: ボード内の確定ボタンは撤去し、下部の待機領域位置に移動 */}

        </Box>
        
        <StatusDock show={roomStatus === "finished"}>
          {roomStatus === "finished" && (
            <GameResultOverlay failed={failed} failedAt={failedAt} mode="inline" />
          )}
        </StatusDock>
      </Box>
      {/* 待機エリア（clue/waiting中・未提出者がいる場合） */}
      {(roomStatus === "clue" || roomStatus === "waiting") && waitingPlayers.length > 0 ? (
        <WaitingArea players={waitingPlayers} />
      ) : null}
      {/* 確定ドック（未提出者がいなくなったら、同じ場所に出す） */}
      {canConfirm && waitingPlayers.length === 0 ? (
        <ConfirmDock onConfirm={onConfirm} label="確定！順番を発表" />
      ) : null}
      {/* 結果オーバーレイ（モック準拠の演出） */}
      {roomStatus === "finished" && showResult && (
        <ArtifactResultOverlay success={!failed} onClose={() => setShowResult(false)} />
      )}
    </Box>
  );
}

export default CentralCardBoard;
