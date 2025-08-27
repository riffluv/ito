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
        minHeight={0} // Allow flex shrinking
      >
        <Box
          bg="#f8fafc" // --slate-50
          border="2px dashed #cbd5e1" // --slate-300
          borderRadius="1rem" // --radius-xl
          padding={{ base: "1rem", md: "1.5rem" }}
          minHeight={{ base: "120px", md: "160px" }} // Responsive min height
          maxHeight="300px" // Prevent overflow
          display="flex"
          alignItems="center"
          justifyContent="center"
          gap={{ base: "0.5rem", md: "1rem" }}
          flexWrap="wrap"
          marginBottom={{ base: "1rem", md: "1.5rem" }}
          width="100%"
          overflowX="auto" // Allow horizontal scroll if needed
          overflowY="hidden"
          css={{
            "&[data-drop-target='true']": {
              borderColor: "#0ea5e9", // --blue-500
              backgroundColor: "#f0f9ff", // --blue-50
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
            height="100%"
            display="flex"
            alignItems="center"
            justifyContent="center"
            gap="1rem"
            flexWrap="wrap"
          >
            {/* Drop Slots and Cards */}
            {resolveMode === "sort-submit" && roomStatus === "clue" ? (
              <DndContext
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext items={activeProposal}>
                  {/* Empty slots for placement */}
                  {Array.from({ length: Math.min(5, Math.max(3, eligibleIds.length)) }).map((_, idx) => {
                    const cardId = activeProposal[idx];
                    return cardId ? (
                      <SortableItem id={cardId} key={cardId}>
                        {renderCard(cardId, idx)}
                      </SortableItem>
                    ) : (
                      <Box
                        key={`slot-${idx}`}
                        width={{ base: "60px", md: "80px" }}
                        height={{ base: "84px", md: "112px" }}
                        border="2px dashed #cbd5e1" // --slate-300
                        borderRadius="0.75rem" // --radius-lg
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
                {/* Rendered cards with slots */}
                {orderList && orderList.length > 0 ? (
                  orderList.map((id, idx) => (
                    <React.Fragment key={id}>
                      {renderCard(id, idx)}
                    </React.Fragment>
                  ))
                ) : (
                  // Show empty drop zones when no cards
                  Array.from({ length: Math.max(3, eligibleIds.length) }).map((_, idx) => (
                    <Box
                      key={`drop-zone-${idx}`}
                      width={{ base: "60px", md: "80px" }}
                      height={{ base: "84px", md: "112px" }}
                      border="2px dashed #cbd5e1"
                      borderRadius="0.75rem"
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
                  ))
                )}
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

            {/* Pending cards */}
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
          </Box>

        </Box>
        
        {/* Progress Section - Professional Style */}
        <Box
          bg="#f8fafc" // --slate-50
          borderRadius="0.75rem" // --radius-lg
          padding="1rem"
          textAlign="center"
        >
          <Box
            color="#64748b" // --slate-600
            marginBottom="0.75rem"
          >
            準備状況: <Box as="strong">{orderList?.length || 0}/{eligibleIds.length}人</Box> がカードを出しました
          </Box>
          <Box
            display="flex"
            gap="0.5rem"
            justifyContent="center"
            flexWrap="wrap"
          >
            {eligibleIds.map((id) => {
              const placed = orderList?.includes(id) || proposal?.includes(id);
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
