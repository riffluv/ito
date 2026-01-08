"use client";

import MiniHandDock from "@/components/ui/MiniHandDock";
import type { RoomDoc } from "@/lib/types";
import type { ComponentProps } from "react";

type MiniHandDockProps = ComponentProps<typeof MiniHandDock>;

export type RoomHandDockNodeProps = {
  roomId: MiniHandDockProps["roomId"];
  room: RoomDoc;
  me: MiniHandDockProps["me"];
  proposal: MiniHandDockProps["proposal"];
  eligibleIds: MiniHandDockProps["eligibleIds"];
  cluesReady: MiniHandDockProps["cluesReady"];
  isHost: MiniHandDockProps["isHost"];
  displayRoomName: string;
  onlineUids: MiniHandDockProps["onlineUids"];
  playerCount: MiniHandDockProps["playerCount"];
  roundIds: MiniHandDockProps["roundIds"];
  presenceReady: MiniHandDockProps["presenceReady"];
  presenceDegraded: MiniHandDockProps["presenceDegraded"];
  interactionEnabled: MiniHandDockProps["interactionEnabled"];
  onOpenSettings: MiniHandDockProps["onOpenSettings"];
  onLeaveRoom: MiniHandDockProps["onLeaveRoom"];
  pop: MiniHandDockProps["pop"];
  hostClaimStatus: MiniHandDockProps["hostClaimStatus"];
  phaseMessage: MiniHandDockProps["phaseMessage"];
  roundPreparing: MiniHandDockProps["roundPreparing"];
  showtimeIntentHandlers: MiniHandDockProps["showtimeIntentHandlers"];
  updateOptimisticProposalOverride: MiniHandDockProps["updateOptimisticProposalOverride"];
};

export function RoomHandDockNode(props: RoomHandDockNodeProps) {
  const {
    roomId,
    room,
    me,
    proposal,
    eligibleIds,
    cluesReady,
    isHost,
    displayRoomName,
    onlineUids,
    playerCount,
    roundIds,
    presenceReady,
    presenceDegraded,
    interactionEnabled,
    onOpenSettings,
    onLeaveRoom,
    pop,
    hostClaimStatus,
    phaseMessage,
    roundPreparing,
    showtimeIntentHandlers,
    updateOptimisticProposalOverride,
  } = props;

  return (
    <MiniHandDock
      roomId={roomId}
      me={me}
      resolveMode={room.options?.resolveMode}
      proposal={proposal}
      eligibleIds={eligibleIds}
      cluesReady={cluesReady}
      isHost={isHost}
      roomStatus={room.status}
      statusVersion={room.statusVersion ?? 0}
      defaultTopicType={room.options?.defaultTopicType || "\u901a\u5e38\u7248"}
      topicBox={room.topicBox ?? null}
      allowContinueAfterFail={!!room.options?.allowContinueAfterFail}
      roomName={displayRoomName}
      currentTopic={room.topic || null}
      onlineUids={onlineUids}
      playerCount={playerCount}
      roundIds={roundIds}
      presenceReady={presenceReady}
      presenceDegraded={presenceDegraded}
      interactionEnabled={interactionEnabled}
      onOpenSettings={onOpenSettings}
      onLeaveRoom={onLeaveRoom}
      pop={pop}
      hostClaimStatus={hostClaimStatus}
      phaseMessage={phaseMessage}
      roundPreparing={roundPreparing}
      showtimeIntentHandlers={showtimeIntentHandlers}
      updateOptimisticProposalOverride={updateOptimisticProposalOverride}
    />
  );
}

