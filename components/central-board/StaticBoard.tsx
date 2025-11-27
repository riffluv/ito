"use client";

import React from "react";
import { Box } from "@chakra-ui/react";

import { EmptyCard } from "@/components/cards";
import Tooltip from "@/components/ui/Tooltip";
import WaitingArea from "@/components/ui/WaitingArea";
import type { StaticSlotDescriptor } from "@/components/hooks/useBoardSlots";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";

import { BoardFrame } from "./BoardFrame";

interface StaticBoardProps {
  slots: StaticSlotDescriptor[];
  renderCard: (id: string, idx: number) => React.ReactNode;
  isOver: boolean;
  canDrop: boolean;
  roomStatus: RoomDoc["status"];
  waitingPlayers: (PlayerDoc & { id: string })[];
  meId: string;
  displayMode?: "full" | "minimal";
  onDropAtPosition: (event: React.DragEvent, index: number) => void;
  onSlotEnter: (index: number) => void;
  onSlotLeave: () => void;
  isRevealing: boolean;
}

function StaticBoardBase({
  slots,
  renderCard,
  isOver,
  canDrop,
  roomStatus,
  waitingPlayers,
  meId,
  displayMode,
  onDropAtPosition,
  onSlotEnter,
  onSlotLeave,
  isRevealing,
}: StaticBoardProps) {
  return (
    <>
      <BoardFrame isActive={isOver && canDrop}>
        {slots.map((slot) => {
          const showCard = slot.showCard && slot.cardId;

          const emptyCard = (
            <EmptyCard
              slotNumber={slot.idx + 1}
              totalSlots={slot.totalSlots}
              isDroppable={slot.allowDrop && !showCard}
              alignSelf="flex-start"
              id={slot.droppableId}
              onDragOver={slot.allowDrop && !showCard ? () => onSlotEnter(slot.idx) : undefined}
              onDragLeave={slot.allowDrop && !showCard ? onSlotLeave : undefined}
              onDrop={slot.allowDrop && !showCard ? (event) => onDropAtPosition(event, slot.idx) : undefined}
              _focusVisible={{
                outline: "2px solid",
                outlineColor: "focusRing",
                outlineOffset: 2,
              }}
              tabIndex={0}
            />
          );

          const renderedEmpty = !slot.allowDrop && !showCard ? (
            <Tooltip content="このスロットはまだ使用できません" openDelay={300} showArrow>
              <Box display="inline-flex" width="100%">
                {emptyCard}
              </Box>
            </Tooltip>
          ) : (
            emptyCard
          );

          return (
            <Box
              key={slot.slotId}
              position="relative"
              display="grid"
              gridTemplateColumns="1fr"
              gridTemplateRows="1fr"
            >
              <Box gridColumn="1 / 2" gridRow="1 / 2">
                {renderedEmpty}
              </Box>

              {showCard ? (
                <Box
                  gridColumn="1 / 2"
                  gridRow="1 / 2"
                  zIndex={1}
                  display="flex"
                  alignItems="stretch"
                  justifyContent="center"
                >
                  <Box position="relative" width="100%">
                    {renderCard(slot.cardId!, slot.idx)}
                  </Box>
                </Box>
              ) : null}
            </Box>
          );
        })}
      </BoardFrame>

      {(roomStatus === "clue" || roomStatus === "waiting") && !isRevealing && waitingPlayers.length > 0 && (
        <Box
          width="100%"
          maxWidth="var(--board-max-width)"
          marginInline="auto"
          mt={{ base: 4, md: 5 }}
          css={{
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
              marginTop: "1.25rem !important",
            },
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
            gameStarted={roomStatus === "clue"}
          />
        </Box>
      )}
    </>
  );
}

export const StaticBoard = React.memo(StaticBoardBase);
StaticBoard.displayName = "CentralStaticBoard";
