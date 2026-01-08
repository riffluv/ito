"use client";

import CentralCardBoard from "@/components/CentralCardBoard";
import UniversalMonitor from "@/components/UniversalMonitor";
import { getDisplayMode } from "@/lib/game/displayMode";
import type { RoomMachineClientEvent } from "@/lib/state/roomMachine";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { Box } from "@chakra-ui/react";

type RoomPlayer = PlayerDoc & { id: string };

type RoomMainNodeProps = {
  roomId: string;
  room: RoomDoc;
  players: RoomPlayer[];
  meId: string;
  eligibleIds: string[];
  cluesReady: boolean;
  proposal: (string | null)[];
  slotCount: number;
  dealPlayers: string[] | null;
  currentStreak: number;
  onOptimisticProposalChange: (
    playerId: string,
    state: "placed" | "removed" | null,
    targetIndex?: number | null
  ) => void;
  sendRoomEvent: (event: RoomMachineClientEvent) => void;
  presenceReady: boolean;
  interactionEnabled: boolean;
};

export function RoomMainNode(props: RoomMainNodeProps) {
  const {
    roomId,
    room,
    players,
    meId,
    eligibleIds,
    cluesReady,
    proposal,
    slotCount,
    dealPlayers,
    currentStreak,
    onOptimisticProposalChange,
    sendRoomEvent,
    presenceReady,
    interactionEnabled,
  } = props;

  return (
    <Box
      h="100%"
      display="grid"
      gridTemplateRows="auto 1fr"
      gap={3}
      minH={0}
      css={{
        "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
          {
            gap: "0.5rem",
            paddingTop: "0.25rem",
          },
      }}
    >
      <Box
        p={0}
        pt={{ base: "56px", md: "64px" }}
        css={{
          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
            {
              paddingTop: "40px !important",
            },
        }}
      >
        <UniversalMonitor room={room} players={players} />
      </Box>
      <Box
        overflow="visible"
        minH={0}
        css={{
          "@media (max-height: 700px) and (min-resolution: 1.5dppx), screen and (max-height: 700px) and (-webkit-device-pixel-ratio: 1.5)":
            {
              overflowY: "auto",
            },
        }}
      >
        <CentralCardBoard
          roomId={roomId}
          players={players}
          orderList={room.order?.list || []}
          meId={meId}
          eligibleIds={eligibleIds}
          roomStatus={room.status}
          cluesReady={cluesReady}
          failed={!!room.order?.failed}
          proposal={proposal}
          resolveMode={room.options?.resolveMode}
          displayMode={getDisplayMode(room)}
          orderNumbers={room.order?.numbers ?? {}}
          orderSnapshots={room.order?.snapshots ?? null}
          slotCount={slotCount}
          topic={room.topic ?? null}
          revealedAt={room.result?.revealedAt ?? null}
          uiRevealPending={room?.ui?.revealPending === true}
          dealPlayers={dealPlayers}
          currentStreak={currentStreak}
          onOptimisticProposalChange={onOptimisticProposalChange}
          sendRoomEvent={sendRoomEvent}
          presenceReady={presenceReady}
          interactionEnabled={interactionEnabled}
        />
      </Box>
    </Box>
  );
}

