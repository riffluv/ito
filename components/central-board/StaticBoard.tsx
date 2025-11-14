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
          if (slot.showCard && slot.cardId) {
            return (
              <React.Fragment key={slot.cardId ?? `slot-${slot.idx}`}>
                {renderCard(slot.cardId, slot.idx)}
              </React.Fragment>
            );
          }

          if (slot.allowDrop) {
            return (
              <EmptyCard
                key={`drop-zone-${slot.idx}`}
                slotNumber={slot.idx + 1}
                totalSlots={slot.totalSlots}
                isDroppable
                alignSelf="flex-start"
                onDragOver={() => onSlotEnter(slot.idx)}
                onDragLeave={onSlotLeave}
                onDrop={(event) => onDropAtPosition(event, slot.idx)}
                _focusVisible={{
                  outline: "2px solid",
                  outlineColor: "focusRing",
                  outlineOffset: 2,
                }}
                tabIndex={0}
              />
            );
          }

          return (
            <Tooltip
              key={`drop-zone-${slot.idx}`}
              content="このスロットはまだ使用できません"
              openDelay={300}
              showArrow
            >
              <Box display="inline-flex">
                <EmptyCard
                  slotNumber={slot.idx + 1}
                  totalSlots={slot.totalSlots}
                  isDroppable={false}
                  alignSelf="flex-start"
                  onDragOver={() => {}}
                  onDragLeave={onSlotLeave}
                  onDrop={() => {}}
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
