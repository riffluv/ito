import { useCallback, type MutableRefObject } from "react";

import { setMetric } from "@/lib/utils/metrics";

export function useHostActionMetrics(params: {
  actionLatencyRef: MutableRefObject<Record<string, number>>;
}): {
  markActionStart: (action: string) => void;
  finalizeAction: (action: string, status: "success" | "error") => void;
  abortAction: (action: string) => void;
} {
  const { actionLatencyRef } = params;

  const markActionStart = useCallback((action: string) => {
    if (typeof performance !== "undefined") {
      actionLatencyRef.current[action] = performance.now();
    }
    setMetric("hostAction", `${action}.pending`, 1);
  }, [actionLatencyRef]);

  const finalizeAction = useCallback(
    (action: string, status: "success" | "error") => {
      const start = actionLatencyRef.current[action];
      if (typeof start === "number" && typeof performance !== "undefined") {
        setMetric("hostAction", `${action}.latencyMs`, Math.round(performance.now() - start));
      }
      delete actionLatencyRef.current[action];
      setMetric("hostAction", `${action}.pending`, 0);
      setMetric("hostAction", `${action}.result`, status === "success" ? 1 : -1);
    },
    [actionLatencyRef]
  );

  const abortAction = useCallback(
    (action: string) => {
      if (actionLatencyRef.current[action]) {
        delete actionLatencyRef.current[action];
      }
      setMetric("hostAction", `${action}.pending`, 0);
    },
    [actionLatencyRef]
  );

  return { markActionStart, finalizeAction, abortAction };
}

