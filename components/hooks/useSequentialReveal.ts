import { useEffect, useRef, useState } from "react";

interface UseSequentialRevealParams {
  orderListLength: number;
  roomStatus?: string;
  resolveMode?: string;
  enabled?: boolean; // allow feature flag
  firstDelayMs?: number;
  flipDelayMs?: number; // delay before flipping each newly added card
}

// Provides a lightweight reveal index for sequential mode so that newly
// placed cards can first show their clue, then flip to show the number.
export function useSequentialReveal({
  orderListLength,
  roomStatus,
  resolveMode,
  enabled = true,
  firstDelayMs = 400,
  flipDelayMs = 550,
}: UseSequentialRevealParams) {
  const [revealIndex, setRevealIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const prevLenRef = useRef(orderListLength);

  useEffect(() => {
    if (!enabled) return;
    if (resolveMode === "sort-submit") return; // only sequential usage
    if (roomStatus !== "clue" && roomStatus !== "finished") return;

    const prev = prevLenRef.current;
    const cur = orderListLength;
    if (cur > prev) {
      // New card(s) appeared. Schedule incremental flips for each new one.
      let cancelled = false;
      setAnimating(true);
      const startBase = performance.now();
      const delta = cur - prev;
      const timers: any[] = [];
      for (let i = 0; i < delta; i++) {
        const delay = i === 0 ? firstDelayMs : firstDelayMs + i * flipDelayMs;
        timers.push(
          setTimeout(() => {
            if (cancelled) return;
            setRevealIndex((r) => Math.min(cur, r + 1));
          }, delay)
        );
      }
      // After last flip, clear animating flag slightly after last delay
      const lastDelay =
        (delta - 1 === 0
          ? firstDelayMs
          : firstDelayMs + (delta - 1) * flipDelayMs) + 150;
      timers.push(
        setTimeout(() => {
          if (!cancelled) setAnimating(false);
        }, lastDelay)
      );
      return () => {
        cancelled = true;
        timers.forEach(clearTimeout);
      };
    }
    // If room finishes, ensure everything is revealed.
    if (roomStatus === "finished") {
      setRevealIndex(orderListLength);
      setAnimating(false);
    }
    prevLenRef.current = orderListLength;
  }, [
    orderListLength,
    roomStatus,
    resolveMode,
    enabled,
    firstDelayMs,
    flipDelayMs,
  ]);

  // Keep prevLenRef updated separately to avoid race conditions
  useEffect(() => {
    prevLenRef.current = orderListLength;
  }, [orderListLength]);

  return { revealIndex, revealAnimating: animating };
}

export default useSequentialReveal;
