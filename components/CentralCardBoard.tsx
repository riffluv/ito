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
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
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
    <Panel
      density="compact"
      p={4}
      h="100%"
      display="flex"
      flexDir="column"
    >
      <Box position="relative" flex="1" display="flex" flexDir="column">
        <Box textAlign="center" mb={4} flex="0 0 auto">
          <Box
            as="span"
            display="inline-block"
            px={4}
            py={2}
            rounded="lg"
            bg="successSubtle"
            fontWeight={700}
            fontSize="md"
          >
            🎯 カードボード（出した順）
          </Box>
        </Box>

        <Box flex="0 0 auto" minH={UNIFIED_LAYOUT.BOARD_MIN_HEIGHT} display="flex" flexDir="column" position="relative">
          <BoardArea
            onDragOver={(e) => {
              e.preventDefault();
              if (canDrop) {
                setIsOver(true);
              }
            }}
            onDragLeave={() => setIsOver(false)}
            onDrop={onDrop}
            isOver={isOver}
            droppable={canDrop}
          >
            {resolveMode === "sort-submit" && roomStatus === "clue" ? (
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext items={activeProposal}>
                  {activeProposal.length > 0 &&
                    activeProposal.map((id, idx) => (
                      <SortableItem id={id} key={id}>
                        {renderCard(id, idx)}
                      </SortableItem>
                    ))}
                </SortableContext>
              </DndContext>
            ) : (
              <>
                {orderList &&
                  orderList.length > 0 &&
                  orderList.map((id, idx) => renderCard(id, idx))}
                {proposal &&
                proposal.length > 0 &&
                roomStatus !== "finished" &&
                roomStatus !== "reveal"
                  ? proposal
                      .filter((id) => !orderList?.includes(id))
                      .map((id) => renderCard(id))
                  : null}
              </>
            )}

            {resolveMode === "sort-submit" &&
              roomStatus === "clue" &&
              activeProposal.length === 0 && (
                <Text color="fgMuted">
                  自分のカードをドラッグして場に置き、連想ワードで相談しましょう。
                </Text>
              )}
            {resolveMode !== "sort-submit" &&
              (!orderList || orderList.length === 0) &&
              (!proposal || proposal.length === 0) &&
              pending.length === 0 &&
              (roomStatus === "clue" && cluesReady === false ? (
                <Box role="status" aria-live="polite">
                  <Text fontWeight={700} color="fgMuted">
                    全員が連想ワードを決定するまでお待ちください
                  </Text>
                </Box>
              ) : (
                <Text color="fgMuted">
                  まだカードが出されていません。自分のカードをドラッグしてここに置いてください。
                </Text>
              ))}

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
          </BoardArea>

          {roomStatus === "finished" && (
            <GameResultOverlay failed={failed} failedAt={failedAt} />
          )}
        </Box>
      </Box>
    </Panel>
  );
}

export default CentralCardBoard;
