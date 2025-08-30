"use client";
import { SortableItem } from "@/components/sortable/SortableItem";
// BoardArea / Panel は現行レイアウトでは未使用のため import を削除
import { CardRenderer } from "@/components/ui/CardRenderer";
import { GameResultOverlay } from "@/components/ui/GameResultOverlay";
import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import { useDropHandler } from "@/components/hooks/useDropHandler";
import { useLocalFailureDetection } from "@/components/hooks/useLocalFailureDetection";
import { setOrderProposal } from "@/lib/game/room";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Text } from "@chakra-ui/react";
import StatusDock from "@/components/ui/StatusDock";
import { DndContext, DragEndEvent, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { SortableContext, arrayMove } from "@dnd-kit/sortable";
import React, { useEffect, useMemo } from "react";

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
}) {
  const map = new Map(players.map((p) => [p.id, p]));
  const me = map.get(meId as string) as any;
  const hasNumber = typeof (me as any)?.number === "number";

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
          bg="panelSubBg"
          border="1px dashed"
          borderColor="borderDefault"
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
            "&[data-drop-target='true']": { borderColor: "accent", backgroundColor: "accentSubtle" },
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
                          
                          border: "2px dashed var(--colors-borderDefault)",
                          borderRadius: "1rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: "transparent",
                          color: "var(--colors-fgMuted)",
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
                        
                        border: "2px dashed var(--colors-borderDefault)",
                        borderRadius: "1rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "transparent",
                        color: "var(--colors-fgMuted)",
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

        </Box>
        
        <StatusDock show={roomStatus === "finished"}>
          {roomStatus === "finished" && (
            <GameResultOverlay failed={failed} failedAt={failedAt} mode="inline" />
          )}
        </StatusDock>
      </Box>
    </Box>
  );
}

export default CentralCardBoard;
