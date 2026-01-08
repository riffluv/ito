"use client";

import { collectServerAssignedSeatIds } from "@/lib/game/selectors";
import { useSpectatorAutoEnterLeave } from "@/lib/hooks/useSpectatorAutoEnterLeave";
import { useSpectatorGate, type SpectatorGateParams } from "@/lib/hooks/useSpectatorGate";
import { useSpectatorJoinStatus } from "@/lib/hooks/useSpectatorJoinStatus";
import type { RoomMachineClientEvent } from "@/lib/state/roomMachine";
import type { PlayerDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import { useEffect, useMemo } from "react";

type RoomPlayer = PlayerDoc & { id: string };

type UseRoomSpectatorGateEffectsParams = {
  roomId: string;
  uid: string | null;
  roomStatus: SpectatorGateParams["roomStatus"];
  joinStatus: SpectatorGateParams["joinStatus"];
  isHost: boolean;
  isMember: boolean;
  joinEstablished: boolean;
  optimisticMe: RoomPlayer | null;
  seatRequestPending: boolean;
  seatAcceptanceActive: boolean;
  loading: boolean;
  forcedExitReason: SpectatorGateParams["forcedExitReason"];
  recallOpen: boolean;
  versionMismatchBlocksAccess: boolean;
  dealPlayers: unknown;
  orderList: unknown;
  proposal: unknown;
  fsmSpectatorNode: SpectatorGateParams["spectatorNode"];
  isSpectatorMode: boolean;
  emitSpectatorEvent: (event: RoomMachineClientEvent) => void;
};

export function useRoomSpectatorGateEffects(params: UseRoomSpectatorGateEffectsParams) {
  const {
    roomId,
    uid,
    roomStatus,
    joinStatus,
    isHost,
    isMember,
    joinEstablished,
    optimisticMe,
    seatRequestPending,
    seatAcceptanceActive,
    loading,
    forcedExitReason,
    recallOpen,
    versionMismatchBlocksAccess,
    dealPlayers,
    orderList,
    proposal,
    fsmSpectatorNode,
    isSpectatorMode,
    emitSpectatorEvent,
  } = params;

  const spectatorJoinStatus = useSpectatorJoinStatus({ joinStatus, roomStatus });
  const hasOptimisticSeat =
    !!optimisticMe &&
    (joinEstablished || seatAcceptanceActive) &&
    !(forcedExitReason || versionMismatchBlocksAccess);

  const serverAssignedSeatIds = useMemo(() => {
    return collectServerAssignedSeatIds({ dealPlayers, orderList, proposal });
  }, [dealPlayers, orderList, proposal]);
  const hasServerAssignedSeat = !!(uid && serverAssignedSeatIds.has(uid));

  const { spectatorEnterReason, spectatorCandidate, mustSpectateMidGame } = useSpectatorGate({
    roomStatus,
    isHost,
    isMember,
    hasOptimisticSeat,
    seatAcceptanceActive,
    seatRequestPending,
    joinStatus: spectatorJoinStatus,
    loading,
    forcedExitReason,
    recallOpen,
    versionMismatchBlocksAccess,
    hasServerAssignedSeat,
    spectatorNode: fsmSpectatorNode,
  });

  useEffect(() => {
    traceAction("spectator.candidate", {
      roomId,
      uid,
      spectatorCandidate,
      joinStatus: spectatorJoinStatus,
      seatRequestPending,
      seatAcceptanceActive,
      hasOptimisticSeat,
      spectatorNode: fsmSpectatorNode,
    });
  }, [
    roomId,
    uid,
    spectatorCandidate,
    spectatorJoinStatus,
    seatRequestPending,
    seatAcceptanceActive,
    hasOptimisticSeat,
    fsmSpectatorNode,
  ]);

  useEffect(() => {
    if (!mustSpectateMidGame) return;
    if (fsmSpectatorNode !== "idle") return;
    emitSpectatorEvent({ type: "SPECTATOR_ENTER", reason: "mid-game" });
  }, [mustSpectateMidGame, fsmSpectatorNode, emitSpectatorEvent]);

  useEffect(() => {
    traceAction("spectator.gate", {
      roomId,
      status: roomStatus,
      spectatorCandidate,
      mustSpectateMidGame,
      recallOpen,
      joinStatus: spectatorJoinStatus,
    });
  }, [
    roomId,
    roomStatus,
    spectatorCandidate,
    mustSpectateMidGame,
    recallOpen,
    spectatorJoinStatus,
  ]);

  useSpectatorAutoEnterLeave({
    uid,
    isSpectatorMode,
    isMember,
    isHost,
    hasOptimisticSeat,
    seatRequestPending,
    seatAcceptanceActive,
    forcedExitReason,
    spectatorCandidate,
    spectatorEnterReason,
    mustSpectateMidGame,
    fsmSpectatorNode,
    emitSpectatorEvent,
  });

  return { hasOptimisticSeat } as const;
}

