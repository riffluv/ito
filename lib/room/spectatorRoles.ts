type DeriveSpectatorFlagsInput = {
  hasUid: boolean;
  isHost: boolean;
  isMember: boolean;
  hasOptimisticSeat: boolean;
  seatAcceptanceActive: boolean;
  seatRequestPending: boolean;
  joinStatus: string;
  loading: boolean;
};

export type SpectatorRoleFlags = {
  isJoiningOrRetrying: boolean;
  spectatorCandidate: boolean;
};

export function deriveSpectatorFlags({
  hasUid,
  isHost,
  isMember,
  hasOptimisticSeat,
  seatAcceptanceActive,
  seatRequestPending,
  joinStatus,
  loading,
}: DeriveSpectatorFlagsInput): SpectatorRoleFlags {
  const isJoiningOrRetrying =
    !seatAcceptanceActive && joinStatus !== "idle" && joinStatus !== "joined";

  const spectatorCandidate =
    hasUid &&
    !isHost &&
    !isMember &&
    !hasOptimisticSeat &&
    !isJoiningOrRetrying &&
    !loading;

  return {
    isJoiningOrRetrying,
    spectatorCandidate,
  };
}
