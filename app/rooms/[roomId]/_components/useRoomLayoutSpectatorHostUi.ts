"use client";

import { useRoomHostActionsUi } from "@/lib/hooks/useRoomHostActionsUi";
import { useSpectatorHostQueue } from "@/lib/spectator/v2/useSpectatorHostQueue";
import { useSpectatorSession } from "@/lib/spectator/v2/useSpectatorSession";
import type { RoomDoc } from "@/lib/types";

type UseRoomLayoutSpectatorHostUiParams = {
  roomId: string;
  room: RoomDoc | null;
  isHost: boolean;
  uid: string | null;
  roomStatus: string | null;
  recallOpen: boolean;
  spectatorHostPanelEnabled: boolean;
};

export function useRoomLayoutSpectatorHostUi(params: UseRoomLayoutSpectatorHostUiParams) {
  const { roomId, room, isHost, uid, roomStatus, recallOpen, spectatorHostPanelEnabled } = params;

  const spectatorRecallEnabled = recallOpen && roomStatus === "waiting";
  const canRecallSpectators = spectatorHostPanelEnabled && isHost && roomStatus === "waiting";

  const {
    dealRecoveryOpen,
    handleDealRecoveryDismiss,
    recallPending,
    handleSpectatorRecall,
  } = useRoomHostActionsUi({
    roomId,
    room,
    isHost,
    spectatorHostPanelEnabled,
    canRecallSpectators,
    spectatorRecallEnabled,
  });

  const spectatorHostQueue = useSpectatorHostQueue(roomId, {
    enabled: spectatorHostPanelEnabled && isHost,
  });
  const {
    requests: spectatorHostRequests,
    loading: spectatorHostLoading,
    error: spectatorHostError,
  } = spectatorHostQueue;

  const spectatorSession = useSpectatorSession({
    roomId,
    viewerUid: uid,
  });
  const { approveRejoin: approveSpectatorRejoin, rejectRejoin: rejectSpectatorRejoin } =
    spectatorSession.actions;

  return {
    dealRecoveryOpen,
    handleDealRecoveryDismiss,
    recallPending,
    handleSpectatorRecall,
    spectatorRecallEnabled,
    canRecallSpectators,
    spectatorHostRequests,
    spectatorHostLoading,
    spectatorHostError,
    spectatorSession,
    approveSpectatorRejoin,
    rejectSpectatorRejoin,
  } as const;
}

