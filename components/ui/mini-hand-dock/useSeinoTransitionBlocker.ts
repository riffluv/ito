"use client";

import React from "react";

const noopCleanup = () => {};

export function useSeinoTransitionBlocker(phaseStatus?: string) {
  const [blocked, setBlocked] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);
  const lastPhaseStatusRef = React.useRef<string | null>(null);

  // Prevent SeinoButton "ghost slide" on room phase transitions (next-round/start/reset):
  // Tier1/Tier2 can apply room status quickly while proposal updates lag behind for a moment.
  React.useEffect(() => {
    if (typeof window === "undefined") return noopCleanup;
    const current = typeof phaseStatus === "string" ? phaseStatus : null;
    const prev = lastPhaseStatusRef.current;
    lastPhaseStatusRef.current = current;
    if (!current || !prev) return noopCleanup;
    if (current === prev) return noopCleanup;

    setBlocked(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setBlocked(false);
    }, 900);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phaseStatus]);

  return blocked;
}

