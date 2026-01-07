import { useMemo } from "react";
import type { SpectatorGateParams } from "@/lib/hooks/useSpectatorGate";

type UseSpectatorJoinStatusParams = {
  joinStatus: SpectatorGateParams["joinStatus"];
  roomStatus: SpectatorGateParams["roomStatus"];
};

export function useSpectatorJoinStatus(
  params: UseSpectatorJoinStatusParams
): SpectatorGateParams["joinStatus"] {
  const { joinStatus, roomStatus } = params;
  return useMemo(() => {
    if (roomStatus === "waiting") {
      return joinStatus;
    }
    return joinStatus === "joined" ? "joined" : "idle";
  }, [joinStatus, roomStatus]);
}
