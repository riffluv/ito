"use client";

import {
  CentralCardBoardView,
  useCentralCardBoardViewProps,
} from "@/components/central-board";
import type { ResolveMode } from "@/lib/game/resolveMode";
import type { RoomMachineClientEvent } from "@/lib/state/roomMachine";
import type { PlayerDoc, PlayerSnapshot, RoomDoc } from "@/lib/types";
import React from "react";

interface CentralCardBoardProps {
  roomId: string;
  players: (PlayerDoc & { id: string })[];
  orderList: string[];
  meId: string;
  eligibleIds: string[];
  roomStatus: RoomDoc["status"];
  cluesReady?: boolean;
  failed: boolean;
  proposal?: (string | null)[];
  resolveMode?: ResolveMode | null;
  orderNumbers?: Record<string, number | null | undefined>;
  orderSnapshots?: Record<string, PlayerSnapshot> | null;
  displayMode?: "full" | "minimal";
  slotCount?: number;
  topic?: string | null;
  revealedAt?: unknown;
  uiRevealPending?: boolean;
  dealPlayers?: string[] | null;
  currentStreak?: number;
  onOptimisticProposalChange?: (
    playerId: string,
    state: "placed" | "removed" | null
  ) => void;
  sendRoomEvent?: (event: RoomMachineClientEvent) => void;
  presenceReady?: boolean;
  interactionEnabled?: boolean;
}

const CentralCardBoard: React.FC<CentralCardBoardProps> = ({
  roomId,
  players,
  orderList,
  meId,
  eligibleIds,
  roomStatus,
  failed,
  proposal,
  resolveMode = "sort-submit",
  orderNumbers = {},
  orderSnapshots = null,
  displayMode = "full",
  slotCount,
  revealedAt,
  uiRevealPending = false,
  dealPlayers = null,
  currentStreak = 0,
  onOptimisticProposalChange,
  sendRoomEvent,
  presenceReady = true,
  interactionEnabled = true,
}) => {
  const viewProps = useCentralCardBoardViewProps({
    roomId,
    players,
    orderList,
    meId,
    eligibleIds,
    roomStatus,
    failed,
    proposal,
    resolveMode,
    orderNumbers,
    orderSnapshots,
    displayMode,
    slotCount,
    revealedAt,
    uiRevealPending,
    dealPlayers,
    currentStreak,
    onOptimisticProposalChange,
    sendRoomEvent,
    presenceReady,
    interactionEnabled,
  });

  return <CentralCardBoardView {...viewProps} />;
};

export default CentralCardBoard;
