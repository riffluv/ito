"use client";

import { useEffect, useState } from "react";

export function usePopPulse(triggerValue: unknown, durationMs = 180) {
  const [pop, setPop] = useState(false);

  useEffect(() => {
    let timeoutId: number | null = null;

    if (typeof triggerValue === "number") {
      setPop(true);
      timeoutId = window.setTimeout(() => setPop(false), durationMs);
    }

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [durationMs, triggerValue]);

  return pop;
}
