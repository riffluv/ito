"use client";

import { useMemo } from "react";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import type { RoomMachineClientEvent } from "@/lib/state/roomMachine";
import { useRoomMachineController } from "@/lib/hooks/useRoomMachineController";
import { useRoomSnapshot } from "@/lib/hooks/useRoomSnapshot";

export type RoomState = {
  room: (RoomDoc & { id: string }) | null;
  players: (PlayerDoc & { id: string })[];
  loading: boolean;
  onlineUids?: string[];
  stableOnlineUids?: string[];
  presenceReady: boolean;
  presenceDegraded: boolean;
  onlinePlayers: (PlayerDoc & { id: string })[];
  isMember: boolean;
  isHost: boolean;
  joinStatus: "idle" | "joining" | "retrying" | "joined";
  phase: RoomDoc["status"];
  sendRoomEvent: (event: RoomMachineClientEvent) => void;
  spectatorStatus: ReturnType<typeof useRoomMachineController>["spectatorState"]["spectatorStatus"];
  spectatorReason: ReturnType<typeof useRoomMachineController>["spectatorState"]["spectatorReason"];
  spectatorRequestSource: ReturnType<typeof useRoomMachineController>["spectatorState"]["spectatorRequestSource"];
  spectatorError: ReturnType<typeof useRoomMachineController>["spectatorState"]["spectatorError"];
  spectatorRequestStatus: ReturnType<typeof useRoomMachineController>["spectatorState"]["spectatorRequestStatus"];
  spectatorRequestCreatedAt: ReturnType<typeof useRoomMachineController>["spectatorState"]["spectatorRequestCreatedAt"];
  spectatorRequestFailure: ReturnType<typeof useRoomMachineController>["spectatorState"]["spectatorRequestFailure"];
  spectatorNode: ReturnType<typeof useRoomMachineController>["spectatorState"]["spectatorNode"];
  roomAccessError: string | null;
  detachNow: () => void;
  reattachPresence: () => void;
  leavingRef: React.MutableRefObject<boolean>;
};

export function useRoomState(
  roomId: string,
  uid: string | null,
  displayName?: string | null
) {
  const snapshot = useRoomSnapshot(roomId, uid, displayName);

  const { phase, spectatorState, sendRoomEvent } = useRoomMachineController({
    roomId,
    uid,
    room: snapshot.room,
    players: snapshot.players,
    onlineUids: snapshot.onlineUids,
    presenceReady: snapshot.presenceReady,
    presenceDegraded: snapshot.presenceDegraded,
  });

  const state: RoomState = useMemo(
    () => ({
      room:
        snapshot.room && phase
          ? { ...snapshot.room, status: phase ?? snapshot.room.status }
          : snapshot.room,
      players: snapshot.players,
      loading: snapshot.loading,
      onlineUids: snapshot.onlineUids,
      stableOnlineUids: snapshot.stableOnlineUids,
      presenceReady: snapshot.presenceReady,
      presenceDegraded: snapshot.presenceDegraded,
      onlinePlayers: snapshot.onlinePlayers,
      isMember: snapshot.isMember,
      isHost: snapshot.isHost,
      joinStatus: snapshot.joinStatus ?? "idle",
      phase: phase ?? snapshot.room?.status ?? "waiting",
      sendRoomEvent,
      spectatorStatus: spectatorState.spectatorStatus,
      spectatorReason: spectatorState.spectatorReason,
      spectatorRequestSource: spectatorState.spectatorRequestSource,
      spectatorError: spectatorState.spectatorError,
      spectatorRequestStatus: spectatorState.spectatorRequestStatus,
      spectatorRequestCreatedAt: spectatorState.spectatorRequestCreatedAt,
      spectatorRequestFailure: spectatorState.spectatorRequestFailure,
      spectatorNode: spectatorState.spectatorNode,
      roomAccessError: snapshot.roomAccessError,
      detachNow: snapshot.detachNow ?? (() => {}),
      reattachPresence: snapshot.reattachPresence ?? (() => {}),
      leavingRef: snapshot.leavingRef,
    }),
    [snapshot, phase, spectatorState, sendRoomEvent]
  );

  return state;
}
