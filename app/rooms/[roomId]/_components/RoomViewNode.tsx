"use client";

import { RoomView } from "@/components/rooms/RoomView";
import type { RoomViewProps } from "@/components/rooms/types";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { stripMinimalTag } from "@/lib/game/displayMode";

type RoomPlayer = PlayerDoc & { id: string };

export type RoomViewNodeProps = {
  roomId: string;
  room: RoomViewProps["room"];
  nodes: RoomViewProps["nodes"];
  overlays: RoomViewProps["overlays"];
  dealRecoveryOpen: boolean;
  onDealRecoveryDismiss: () => void;
  needName: boolean;
  onSubmitName: (name: string) => void;
  canStartSorting: boolean;
  chat: {
    players: RoomPlayer[];
    hostId: string | null;
    isFinished: boolean;
    onOpenLedger: () => void;
    ledgerLabel: string;
    canOpenLedger: boolean;
  };
  passwordDialog: {
    isOpen: boolean;
    isLoading: boolean;
    error: string | null;
    onSubmit: (password: string) => void;
    onCancel: () => void;
  };
  settings: {
    isOpen: boolean;
    onClose: () => void;
    isHost: boolean;
  };
  ledger: {
    isOpen: boolean;
    onClose: () => void;
    players: RoomPlayer[];
    orderList: string[];
    topic: string | null;
    failed: boolean;
    roomId: string;
    myId: string;
    mvpVotes: RoomViewProps["ledger"]["mvpVotes"];
    stats: RoomViewProps["ledger"]["stats"];
    readOnly: boolean;
    contextLabel: string | null;
  };
  me: RoomPlayer | null;
  isSpectatorMode: boolean;
  meHasPlacedCard: boolean;
};

export function RoomViewNode(props: RoomViewNodeProps) {
  const {
    roomId,
    room,
    nodes,
    overlays,
    dealRecoveryOpen,
    onDealRecoveryDismiss,
    needName,
    onSubmitName,
    canStartSorting,
    chat,
    passwordDialog,
    settings,
    ledger,
    me,
    isSpectatorMode,
    meHasPlacedCard,
  } = props;

  return (
    <RoomView
      roomId={roomId}
      room={room}
      nodes={nodes}
      overlays={overlays}
      dealRecoveryOpen={dealRecoveryOpen}
      onDealRecoveryDismiss={onDealRecoveryDismiss}
      needName={needName}
      onSubmitName={onSubmitName}
      simplePhase={{
        status: room.status || "waiting",
        canStartSorting,
        topic: room.topic || null,
      }}
      chat={{
        players: chat.players,
        hostId: chat.hostId,
        isFinished: chat.isFinished,
        onOpenLedger: chat.onOpenLedger,
        ledgerLabel: chat.ledgerLabel,
        canOpenLedger: chat.canOpenLedger,
      }}
      passwordDialog={{
        isOpen: passwordDialog.isOpen,
        roomName: stripMinimalTag(room.name),
        isLoading: passwordDialog.isLoading,
        error: passwordDialog.error,
        onSubmit: passwordDialog.onSubmit,
        onCancel: passwordDialog.onCancel,
      }}
      settings={{
        isOpen: settings.isOpen,
        onClose: settings.onClose,
        options: room.options ?? ({} as RoomDoc["options"]),
        isHost: settings.isHost,
        roomStatus: room.status || "waiting",
      }}
      ledger={{
        isOpen: ledger.isOpen,
        onClose: ledger.onClose,
        players: ledger.players,
        orderList: ledger.orderList,
        topic: ledger.topic,
        failed: ledger.failed,
        roomId: ledger.roomId,
        myId: ledger.myId,
        mvpVotes: ledger.mvpVotes,
        stats: ledger.stats,
        readOnly: ledger.readOnly,
        contextLabel: ledger.contextLabel,
      }}
      me={me}
      isSpectatorMode={isSpectatorMode}
      meHasPlacedCard={meHasPlacedCard}
    />
  );
}
