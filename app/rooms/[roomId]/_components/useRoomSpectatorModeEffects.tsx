"use client";

import type { RoomMachineClientEvent } from "@/lib/state/roomMachine";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import { useEffect, type Dispatch, type SetStateAction } from "react";

type RoomPlayer = PlayerDoc & { id: string };

type UseRoomSpectatorModeEffectsParams = {
  roomId: string;
  uid: string | null;
  isSpectatorMode: boolean;
  isMember: boolean;
  roomStatus: RoomDoc["status"] | null;
  versionMismatchBlocksAccess: boolean;
  spectatorNode: string;
  seatRequestStatus: string;
  optimisticMe: RoomPlayer | null;
  setOptimisticMe: Dispatch<SetStateAction<RoomPlayer | null>>;
  emitSpectatorEvent: (event: RoomMachineClientEvent) => void;
};

export function useRoomSpectatorModeEffects(params: UseRoomSpectatorModeEffectsParams) {
  const {
    roomId,
    uid,
    isSpectatorMode,
    isMember,
    roomStatus,
    versionMismatchBlocksAccess,
    spectatorNode,
    seatRequestStatus,
    optimisticMe,
    setOptimisticMe,
    emitSpectatorEvent,
  } = params;

  useEffect(() => {
    traceAction("spectator.mode", {
      roomId,
      uid,
      isSpectatorMode,
      isMember,
      roomStatus,
      spectatorNode,
    });

    // Spectator V3: 観戦遷移時のトレースと状態初期化
    if (isSpectatorMode && uid) {
      traceAction("spectator.enter", {
        roomId,
        uid,
        reason: versionMismatchBlocksAccess
          ? "version-mismatch"
          : roomStatus === "waiting"
            ? "waiting"
            : "mid-game",
      });

      // 観戦遷移時の状態初期化を厳密化
      if (optimisticMe) {
        setOptimisticMe(null);
      }
      // 他の残留状態もクリア
      if (seatRequestStatus !== "idle") {
        emitSpectatorEvent({ type: "SPECTATOR_RESET" });
      }
    }
  }, [
    roomId,
    uid,
    isSpectatorMode,
    isMember,
    roomStatus,
    versionMismatchBlocksAccess,
    emitSpectatorEvent,
    seatRequestStatus,
    spectatorNode,
    optimisticMe,
    setOptimisticMe,
  ]);
}

