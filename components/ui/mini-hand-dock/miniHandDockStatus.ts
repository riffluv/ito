export function deriveEffectiveRoomStatus(params: {
  roomStatus: string | undefined;
  resetUiPending: boolean;
  isResetting: boolean;
}): { optimisticResetting: boolean; effectiveRoomStatus: string | undefined } {
  const { roomStatus, resetUiPending, isResetting } = params;
  const optimisticResetting =
    (resetUiPending || isResetting) && roomStatus !== "waiting";
  const effectiveRoomStatus = optimisticResetting ? "waiting" : roomStatus;
  return { optimisticResetting, effectiveRoomStatus };
}
