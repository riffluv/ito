import { logDebug } from "@/lib/utils/log";
import { useEffect, useRef } from "react";

type ForcedExitReason = "game-in-progress" | "version-mismatch" | null;

type UseSpectatorStateLoggingParams = {
  roomId: string;
  uid: string | null;
  roomStatus: string | null;
  spectatorNode: string | null;
  isMember: boolean;
  canAccess: boolean;
  forcedExitReason: ForcedExitReason;
  spectatorReason: string | null;
  joinStatus: string;
  playersSignature: string;
  waitingToRejoin: boolean;
};

export function useSpectatorStateLogging(params: UseSpectatorStateLoggingParams) {
  const {
    roomId,
    uid,
    roomStatus,
    spectatorNode,
    isMember,
    canAccess,
    forcedExitReason,
    spectatorReason,
    joinStatus,
    playersSignature,
    waitingToRejoin,
  } = params;

  const spectatorStateLogRef = useRef<{
    roomStatus: string | null;
    isMember: boolean;
    canAccess: boolean;
    forcedExitReason: ForcedExitReason;
    spectatorReason: string | null;
    spectatorNode: string | null;
    joinStatus: string;
    playersSignature: string;
    waitingToRejoin: boolean;
  } | null>(null);

  useEffect(() => {
    const nextState = {
      roomStatus,
      spectatorNode,
      isMember,
      canAccess,
      forcedExitReason,
      spectatorReason,
      joinStatus,
      playersSignature,
      waitingToRejoin,
    };
    const prev = spectatorStateLogRef.current;
    if (
      !prev ||
      prev.roomStatus !== nextState.roomStatus ||
      prev.isMember !== nextState.isMember ||
      prev.canAccess !== nextState.canAccess ||
      prev.forcedExitReason !== nextState.forcedExitReason ||
      prev.spectatorReason !== nextState.spectatorReason ||
      prev.spectatorNode !== nextState.spectatorNode ||
      prev.joinStatus !== nextState.joinStatus ||
      prev.playersSignature !== nextState.playersSignature ||
      prev.waitingToRejoin !== nextState.waitingToRejoin
    ) {
      spectatorStateLogRef.current = nextState;
      logDebug("room-page", "spectator-state", {
        roomId,
        uid,
        ...nextState,
      });
    }
  }, [
    roomStatus,
    spectatorNode,
    isMember,
    canAccess,
    forcedExitReason,
    spectatorReason,
    joinStatus,
    playersSignature,
    waitingToRejoin,
    roomId,
    uid,
  ]);
}

