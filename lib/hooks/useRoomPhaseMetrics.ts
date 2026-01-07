"use client";

import { setMetric } from "@/lib/utils/metrics";
import type { RoomDoc } from "@/lib/types";
import { useEffect, useRef } from "react";

type UseRoomPhaseMetricsParams = {
  roomStatus: RoomDoc["status"] | null;
  isHost: boolean;
};

export function useRoomPhaseMetrics(params: UseRoomPhaseMetricsParams) {
  const { roomStatus, isHost } = params;
  const phaseMetricRef = useRef<RoomDoc["status"] | null>(null);

  useEffect(() => {
    if (!roomStatus) return;
    if (phaseMetricRef.current === roomStatus) return;
    phaseMetricRef.current = roomStatus;
    setMetric("phase", "status", roomStatus);
    if (typeof performance !== "undefined") {
      setMetric("phase", "transitionAt", Math.round(performance.now()));
    }
  }, [roomStatus]);

  useEffect(() => {
    setMetric("room", "isHost", isHost ? 1 : 0);
  }, [isHost]);
}

