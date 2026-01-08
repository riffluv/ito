"use client";

import DragonQuestParty from "@/components/ui/DragonQuestParty";
import type { PlayerDoc, RoomDoc } from "@/lib/types";

type RoomPlayer = PlayerDoc & { id: string };

type RoomSidebarNodeProps = {
  players: RoomPlayer[];
  roomStatus: RoomDoc["status"];
  onlineCount: number;
  onlineUids: string[] | undefined;
  hostId: string | null | undefined;
  roomId: string;
  isHostUser: boolean;
  eligibleIds: string[];
  roundIds: string[];
  submittedPlayerIds: string[];
  fallbackNames: Record<string, string>;
  displayRoomName: string;
  suspendTransientUpdates: boolean;
};

export function RoomSidebarNode(props: RoomSidebarNodeProps) {
  const {
    players,
    roomStatus,
    onlineCount,
    onlineUids,
    hostId,
    roomId,
    isHostUser,
    eligibleIds,
    roundIds,
    submittedPlayerIds,
    fallbackNames,
    displayRoomName,
    suspendTransientUpdates,
  } = props;

  return (
    <DragonQuestParty
      players={players}
      roomStatus={roomStatus || "waiting"}
      onlineCount={onlineCount}
      onlineUids={onlineUids}
      hostId={hostId ?? undefined}
      roomId={roomId}
      isHostUser={isHostUser}
      eligibleIds={eligibleIds}
      roundIds={roundIds}
      submittedPlayerIds={submittedPlayerIds}
      fallbackNames={fallbackNames}
      displayRoomName={displayRoomName}
      suspendTransientUpdates={suspendTransientUpdates}
    />
  );
}

