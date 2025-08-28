"use client";
import { SortableItem } from "@/components/sortable/SortableItem";
import BoardArea from "@/components/ui/BoardArea";
import { Panel } from "@/components/ui/Panel";
import { CardRenderer } from "@/components/ui/CardRenderer";
import { GameResultOverlay } from "@/components/ui/GameResultOverlay";
import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import { useDropHandler } from "@/components/hooks/useDropHandler";
import { useLocalFailureDetection } from "@/components/hooks/useLocalFailureDetection";
import { setOrderProposal } from "@/lib/game/room";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Text } from "@chakra-ui/react";
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
      {/* Board Header - Professional Style */}
      <Box
        textAlign="center"
        marginBottom="1.5rem"
        flex="0 0 auto"
      >
        <Box
          fontWeight={600}
          color="#334155" // --slate-700
          marginBottom="1.5rem"
        >
          カードを小さい順（左）から大きい順（右）に並べよう！
        </Box>
      </Box>

      {/* Professional Card Area - Responsive Design */}
      <Box 
        flex="1" 
        display="flex" 
        flexDirection="column" 
        alignItems="center" 
        justifyContent="center"
        overflow="hidden" // 根本解決: Flexコンテナの適切なoverflow制御
        position="relative" // Flex子要素の適切な配置コンテキスト
      >
        <Box
          bg="#f8fafc" // --slate-50
          border="2px dashed #cbd5e1" // --slate-300
          borderRadius="1rem" // --radius-xl
          padding={{ base: "1rem", md: "1.5rem" }}
          minHeight={{ base: "200px", md: "240px" }} // カードサイズに対応した最小高さ
          // maxHeightを除去 - コンテントに応じて自然に伸縮
          display="flex"
          alignItems="center" // カードが中央に美しく配置
          justifyContent="center"
          gap={{ base: "0.5rem", md: "1rem" }}
          flexWrap="wrap"
          marginBottom={{ base: "1rem", md: "1.5rem" }}
          width="100%"
          // スクロールは不要 - コンテンツに応じて自然に伸縮
          css={{
            "&[data-drop-target='true']": {
              borderColor: "#0ea5e9", // --blue-500
              backgroundColor: "#f0f9ff", // --blue-50
            },
            // スクロールバーのスタイル改善
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              background: "#f1f5f9",
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-thumb": {
              background: "#cbd5e1",
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              background: "#94a3b8",
            },
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
            display="flex"
            alignItems="flex-start" // 上揃えで一貫性保持
            justifyContent="center"
            gap={{ base: "0.5rem", md: "1rem" }}
            flexWrap="wrap"
            minHeight="inherit" // 親の minHeight を継承
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
                        width={UNIFIED_LAYOUT.CARD.WIDTH} // 手札と同じサイズ
                        height={UNIFIED_LAYOUT.CARD.HEIGHT} // 手札と同じサイズ
                        border="2px dashed #cbd5e1" // --slate-300
                        borderRadius="1rem" // --radius-xl (手札と統一)
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        bg="transparent"
                        flexShrink={0}
                        color="#94a3b8"
                        fontSize="0.75rem"
                        fontWeight={500}
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
                      width={UNIFIED_LAYOUT.CARD.WIDTH} // 手札と同じサイズ
                      height={UNIFIED_LAYOUT.CARD.HEIGHT} // 手札と同じサイズ
                      border="2px dashed #cbd5e1"
                      borderRadius="1rem" // --radius-xl (手札と統一)
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      bg="transparent"
                      flexShrink={0}
                      color="#94a3b8"
                      fontSize="0.75rem"
                      fontWeight={500}
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
        
        {/* Progress Section - Professional Style (Mock準拠) */}
        <Box
          bg="#f8fafc" // --slate-50
          borderRadius="0.75rem"
          padding="1rem"
          textAlign="center"
        >
          <Box
            color="#64748b" // --slate-600
            marginBottom="0.75rem"
          >
            準備状況: <Box as="strong">
              {resolveMode === "sort-submit" 
                ? `${proposal?.length || 0}/${eligibleIds.length}人` 
                : `${orderList?.length || 0}/${eligibleIds.length}人`
              }
            </Box> がカードを出しました
          </Box>
          <Box
            display="flex"
            gap="0.5rem"
            justifyContent="center"
            flexWrap="wrap"
          >
            {eligibleIds.map((id) => {
              const placed = resolveMode === "sort-submit" 
                ? proposal?.includes(id) 
                : orderList?.includes(id);
              const player = map.get(id);
              return (
                <Box
                  key={id}
                  bg={placed ? "#dcfce7" : "#fef3c7"} // green-100 : amber-100
                  color={placed ? "#16a34a" : "#f59e0b"} // green-600 : amber-500
                  fontSize="0.75rem"
                  padding="0.25rem 0.5rem"
                  borderRadius="0.375rem"
                  fontWeight={500}
                >
                  {player?.name || "Unknown"}
                </Box>
              );
            })}
          </Box>
        </Box>
        
        {roomStatus === "finished" && (
          <GameResultOverlay failed={failed} failedAt={failedAt} />
        )}
      </Box>
    </Box>
  );
}

export default CentralCardBoard;
