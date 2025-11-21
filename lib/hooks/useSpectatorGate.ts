"use client";

import { useMemo } from "react";
import { deriveSpectatorFlags } from "@/lib/room/spectatorRoles";
import type { RoomDoc } from "@/lib/types";
import type { SpectatorStatus, SpectatorReason } from "@/lib/state/roomMachine";

export type SpectatorGateParams = {
  roomStatus: RoomDoc["status"] | null;
  isHost: boolean;
  isMember: boolean;
  hasOptimisticSeat: boolean;
  seatAcceptanceActive: boolean;
  seatRequestPending: boolean;
  joinStatus: "idle" | "joining" | "retrying" | "joined";
  loading: boolean;
  forcedExitReason: "game-in-progress" | "version-mismatch" | null;
  recallOpen: boolean;
  versionMismatchBlocksAccess: boolean;
  hasServerAssignedSeat: boolean;
  spectatorNode: SpectatorStatus;
};

export type SpectatorGateResult = {
  spectatorEnterReason: Exclude<SpectatorReason, null>;
  spectatorCandidate: boolean;
  mustSpectateMidGame: boolean;
  loadingForSpectator: boolean;
};

export const computeSpectatorGate = ({
  roomStatus,
  isHost,
  isMember,
  hasOptimisticSeat,
  seatAcceptanceActive,
  seatRequestPending,
  joinStatus,
  loading,
  forcedExitReason,
  recallOpen,
  versionMismatchBlocksAccess,
  hasServerAssignedSeat,
}: SpectatorGateParams): SpectatorGateResult => {
  const allowSpectatorWhileLoading =
    loading && !isHost && !hasServerAssignedSeat && roomStatus !== "waiting";
  const loadingForSpectator = loading && !allowSpectatorWhileLoading;

  const { spectatorCandidate } = deriveSpectatorFlags({
    hasUid: true,
    isHost,
    isMember,
    hasOptimisticSeat,
    seatAcceptanceActive,
    seatRequestPending,
    joinStatus,
    loading: loadingForSpectator,
  });

  const spectatorEnterReason: Exclude<SpectatorReason, null> = versionMismatchBlocksAccess || forcedExitReason === "version-mismatch"
    ? "version-mismatch"
    : roomStatus === "waiting"
    ? recallOpen
      ? "waiting-open"
      : "waiting-closed"
    : "mid-game";

  const mustSpectateMidGame =
    roomStatus !== "waiting" &&
    !isHost &&
    !isMember &&
    !hasOptimisticSeat &&
    !hasServerAssignedSeat;

  return {
    spectatorEnterReason,
    spectatorCandidate,
    mustSpectateMidGame,
    loadingForSpectator,
  };
};

export function useSpectatorGate(params: SpectatorGateParams): SpectatorGateResult {
  return useMemo(() => computeSpectatorGate(params), [params]);
}
