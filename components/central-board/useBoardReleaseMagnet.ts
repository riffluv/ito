import { useCallback } from "react";
import type { MagnetResult } from "@/lib/ui/dragMagnet";

import { createInitialMagnetState } from "./constants";

export function useBoardReleaseMagnet(params: {
  scheduleMagnetTarget: (nextId: string | null) => void;
  getProjectedMagnetState: () => MagnetResult;
  enqueueMagnetUpdate: (update: { state: MagnetResult }) => void;
}): { releaseMagnet: () => void } {
  const { scheduleMagnetTarget, getProjectedMagnetState, enqueueMagnetUpdate } =
    params;

  const releaseMagnet = useCallback(() => {
    scheduleMagnetTarget(null);
    const projectedState = getProjectedMagnetState();
    if (
      projectedState.dx !== 0 ||
      projectedState.dy !== 0 ||
      projectedState.strength > 0 ||
      projectedState.shouldSnap
    ) {
      enqueueMagnetUpdate({ state: createInitialMagnetState() });
    }
  }, [enqueueMagnetUpdate, getProjectedMagnetState, scheduleMagnetTarget]);

  return { releaseMagnet };
}

