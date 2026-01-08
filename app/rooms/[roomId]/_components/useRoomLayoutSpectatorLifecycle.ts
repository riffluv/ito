"use client";

import { useForcedExit } from "@/lib/hooks/useForcedExit";
import { useRedirectGuard } from "@/lib/hooks/useRedirectGuard";
import { useRoomLeaveFlow } from "@/lib/hooks/useRoomLeaveFlow";
import { useRoomOptimisticSeatHold } from "@/lib/hooks/useRoomOptimisticSeatHold";
import { useSpectatorStateLogging } from "@/lib/hooks/useSpectatorStateLogging";
import { useRoomSpectatorFlow } from "@/lib/spectator/v2/useRoomSpectatorFlow";
import type { RoomMachineClientEvent } from "@/lib/state/roomMachine";
import { useCallback, useEffect, useState } from "react";
import { useRoomSpectatorGateEffects } from "./useRoomSpectatorGateEffects";
import { useRoomSpectatorModeEffects } from "./useRoomSpectatorModeEffects";

type LeaveFlowParams = Parameters<typeof useRoomLeaveFlow>[0];
type SpectatorFlowParams = Parameters<typeof useRoomSpectatorFlow>[0];
type OptimisticSeatHoldParams = Parameters<typeof useRoomOptimisticSeatHold>[0];
type RoomSpectatorGateEffectsParams = Parameters<typeof useRoomSpectatorGateEffects>[0];
type RoomSpectatorModeEffectsParams = Parameters<typeof useRoomSpectatorModeEffects>[0];

type UseRoomLayoutSpectatorLifecycleParams = {
  roomId: string;
  uid: string | null;
  isHost: boolean;
  isMember: boolean;
  joinStatus: RoomSpectatorGateEffectsParams["joinStatus"];
  sendRoomEvent: (event: RoomMachineClientEvent) => void;
  leavingRef: LeaveFlowParams["leavingRef"];
  reattachPresence: SpectatorFlowParams["reattachPresence"];
  spectatorFsm: SpectatorFlowParams["spectatorFsm"];
  spectatorSession: SpectatorFlowParams["spectatorSession"];
  spectatorRecallEnabled: SpectatorFlowParams["spectatorRecallEnabled"];
  roomStatus: SpectatorFlowParams["roomStatus"];
  recallOpen: SpectatorFlowParams["recallOpen"];
  router: LeaveFlowParams["router"];
  transition: LeaveFlowParams["transition"];
  user: LeaveFlowParams["user"];
  detachNow: LeaveFlowParams["detachNow"];
  displayName: LeaveFlowParams["displayName"];
  lastKnownHostId: string | null;
  joinEstablished: boolean;
  optimisticMe: OptimisticSeatHoldParams["optimisticMe"];
  setOptimisticMe: OptimisticSeatHoldParams["setOptimisticMe"];
  meFromPlayers: OptimisticSeatHoldParams["meFromPlayers"];
  me: OptimisticSeatHoldParams["me"];
  loading: boolean;
  authLoading: boolean;
  playersSignature: string;
  dealPlayers: RoomSpectatorGateEffectsParams["dealPlayers"];
  orderList: RoomSpectatorGateEffectsParams["orderList"];
  proposal: RoomSpectatorGateEffectsParams["proposal"];
  fsmSpectatorNode: RoomSpectatorGateEffectsParams["fsmSpectatorNode"];
};

export function useRoomLayoutSpectatorLifecycle(params: UseRoomLayoutSpectatorLifecycleParams) {
  const {
    roomId,
    uid,
    isHost,
    isMember,
    joinStatus,
    sendRoomEvent,
    leavingRef,
    reattachPresence,
    spectatorFsm,
    spectatorSession,
    spectatorRecallEnabled,
    roomStatus,
    recallOpen,
    router,
    transition,
    user,
    detachNow,
    displayName,
    lastKnownHostId,
    joinEstablished,
    optimisticMe,
    setOptimisticMe,
    meFromPlayers,
    me,
    loading,
    authLoading,
    playersSignature,
    dealPlayers,
    orderList,
    proposal,
    fsmSpectatorNode,
  } = params;

  const redirectGuard = useRedirectGuard(1200);
  const [forcedExitReason, setForcedExitReason] = useState<LeaveFlowParams["forcedExitReason"]>(
    null
  );
  const versionMismatchBlocksAccess = false;

  const emitSpectatorEvent = useCallback(
    (event: RoomMachineClientEvent) => {
      sendRoomEvent(event);
    },
    [sendRoomEvent]
  );

  const {
    isSpectatorMode,
    seatRequestTimedOut,
    spectatorController,
    handleRetryJoin,
    seatAcceptanceActive,
    seatRequestPending,
    seatRequestAccepted,
    clearRejoinIntent,
    suppressAutoJoinIntent,
    cancelSeatRequestSafely,
  } = useRoomSpectatorFlow({
    roomId,
    uid,
    isHost,
    isMember,
    spectatorFsm,
    versionMismatchBlocksAccess,
    emitSpectatorEvent,
    leavingRef,
    spectatorSession,
    spectatorRecallEnabled,
    roomStatus,
    recallOpen,
    setForcedExitReason,
    reattachPresence,
  });

  const spectatorReason = spectatorController.state.reason;
  const seatRequestState = spectatorController.state.seatRequest;
  const hasRejoinIntent = spectatorController.utils.hasRejoinIntent;

  const { leaveRoom, handleForcedExitLeaveNow } = useRoomLeaveFlow({
    roomId,
    uid,
    displayName,
    router,
    transition,
    user,
    detachNow,
    leavingRef,
    versionMismatchBlocksAccess,
    forcedExitReason,
    setForcedExitReason,
    roomStatus,
    recallOpen,
    sendRoomEvent: emitSpectatorEvent,
  });

  const { hasOptimisticSeat } = useRoomSpectatorGateEffects({
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
  });
  const canAccess = (isMember || isHost || hasOptimisticSeat) && !versionMismatchBlocksAccess;

  useRoomSpectatorModeEffects({
    roomId,
    uid,
    isSpectatorMode,
    isMember,
    roomStatus,
    versionMismatchBlocksAccess,
    spectatorNode: fsmSpectatorNode as RoomSpectatorModeEffectsParams["spectatorNode"],
    seatRequestStatus: seatRequestState.status,
    optimisticMe,
    setOptimisticMe,
    emitSpectatorEvent,
  });

  useRoomOptimisticSeatHold({
    uid,
    isSpectatorMode,
    meFromPlayers,
    me,
    joinEstablished,
    seatRequestPending,
    seatAcceptanceActive,
    seatRequestAccepted,
    displayName,
    optimisticMe,
    setOptimisticMe,
  });

  // 観戦理由の判定（文言出し分け用）
  const waitingToRejoin = roomStatus === "waiting";

  useSpectatorStateLogging({
    roomId,
    uid,
    roomStatus,
    spectatorNode: fsmSpectatorNode ?? null,
    isMember,
    canAccess,
    forcedExitReason,
    spectatorReason,
    joinStatus,
    playersSignature,
    waitingToRejoin,
  });

  const skipForcedExit = !uid || !isMember;

  useForcedExit({
    uid,
    roomStatus: roomStatus ?? undefined,
    canAccess,
    spectatorNode: fsmSpectatorNode,
    loading,
    authLoading,
    hasRejoinIntent,
    clearRejoinIntent,
    suppressAutoJoinIntent,
    cancelSeatRequestSafely,
    redirectGuard,
    lastKnownHostId,
    leavingRef,
    detachNow,
    setForcedExitReason,
    roomId,
    displayName,
    sendRoomEvent: emitSpectatorEvent,
    recallOpen,
    skip: skipForcedExit,
  });

  useEffect(() => {
    if (!forcedExitReason) return;
    if (!canAccess && roomStatus !== "waiting") return;

    if (roomStatus === "waiting") {
      leavingRef.current = false;
    }
    setForcedExitReason(null);
  }, [
    forcedExitReason,
    canAccess,
    roomStatus,
    uid,
    displayName,
    leavingRef,
    setForcedExitReason,
  ]);

  return {
    isSpectatorMode,
    seatRequestTimedOut,
    spectatorController,
    handleRetryJoin,
    seatAcceptanceActive,
    seatRequestPending,
    seatRequestAccepted,
    leaveRoom,
    handleForcedExitLeaveNow,
    forcedExitReason,
  } as const;
}

