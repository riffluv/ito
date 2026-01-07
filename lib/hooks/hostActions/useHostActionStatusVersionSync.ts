import { useEffect } from "react";

import { setMetric } from "@/lib/utils/metrics";

export function useHostActionStatusVersionSync(params: {
  statusVersion?: number | null;
  latestStatusVersionRef: { current: number };
  expectedStatusVersionRef: {
    current: { quickStart: number | null; nextGame: number | null; reset: number | null };
  };
  resetOkAtRef: { current: number | null };
  quickStartOkAtRef: { current: number | null };
  nextGameOkAtRef: { current: number | null };
}): void {
  const {
    statusVersion,
    latestStatusVersionRef,
    expectedStatusVersionRef,
    resetOkAtRef,
    quickStartOkAtRef,
    nextGameOkAtRef,
  } = params;

  useEffect(() => {
    if (typeof statusVersion === "number" && Number.isFinite(statusVersion)) {
      latestStatusVersionRef.current = statusVersion;
    }
  }, [latestStatusVersionRef, statusVersion]);

  useEffect(() => {
    if (typeof statusVersion !== "number" || typeof performance === "undefined") {
      return;
    }
    const now = performance.now();
    const expected = expectedStatusVersionRef.current;

    if (expected.reset !== null && statusVersion >= expected.reset) {
      if (resetOkAtRef.current !== null) {
        setMetric(
          "hostAction",
          "reset.statusVersionSyncMs",
          Math.max(0, Math.round(now - resetOkAtRef.current))
        );
      }
      expected.reset = null;
      setMetric("hostAction", "reset.expectedStatusVersion", null);
    }

    if (expected.quickStart !== null && statusVersion >= expected.quickStart) {
      if (quickStartOkAtRef.current !== null) {
        setMetric(
          "hostAction",
          "quickStart.statusVersionSyncMs",
          Math.max(0, Math.round(now - quickStartOkAtRef.current))
        );
      }
      expected.quickStart = null;
      setMetric("hostAction", "quickStart.expectedStatusVersion", null);
    }

    if (expected.nextGame !== null && statusVersion >= expected.nextGame) {
      if (nextGameOkAtRef.current !== null) {
        setMetric(
          "hostAction",
          "nextGame.statusVersionSyncMs",
          Math.max(0, Math.round(now - nextGameOkAtRef.current))
        );
      }
      expected.nextGame = null;
      setMetric("hostAction", "nextGame.expectedStatusVersion", null);
    }
  }, [
    expectedStatusVersionRef,
    nextGameOkAtRef,
    quickStartOkAtRef,
    resetOkAtRef,
    statusVersion,
  ]);
}

