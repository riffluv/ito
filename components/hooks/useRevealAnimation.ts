import { finalizeReveal } from "@/lib/game/room";
import {
  REVEAL_FIRST_DELAY,
  REVEAL_LINGER,
  REVEAL_STEP_DELAY,
} from "@/lib/ui/motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface UseRevealAnimationProps {
  roomId: string;
  roomStatus?: string;
  resolveMode?: string;
  orderListLength: number;
}

export function useRevealAnimation({
  roomId,
  roomStatus,
  resolveMode,
  orderListLength,
}: UseRevealAnimationProps) {
  const [revealAnimating, setRevealAnimating] = useState(false);
  const [revealIndex, setRevealIndex] = useState(0);
  const prevStatusRef = useRef(roomStatus);

  // Start reveal animation: useLayoutEffect so we set the flag before the
  // browser paints. This avoids a render where `roomStatus === 'reveal'` but
  // `revealAnimating` is still false, which caused a brief undesired frame
  // where cards appeared in the default (dark) state.
  useLayoutEffect(() => {
    const prev = prevStatusRef.current;
    const becameReveal = prev !== "reveal" && roomStatus === "reveal";
    const isRevealNow = roomStatus === "reveal";
    const shouldStart =
      resolveMode === "sort-submit" &&
      orderListLength > 0 &&
      (becameReveal || (isRevealNow && !revealAnimating && revealIndex === 0));

    if (shouldStart) {
      setRevealAnimating(true);
      setRevealIndex(0);
    }
    prevStatusRef.current = roomStatus;
  }, [roomStatus, resolveMode, orderListLength, revealAnimating, revealIndex]);

  // Handle reveal animation progression（最後の1枚後に余韻を入れる）
  useEffect(() => {
    if (!revealAnimating) return;

    if (revealIndex >= orderListLength) {
      // Keep the animation flag true during the linger period so the UI
      // doesn't revert to the "face-down" state while waiting to finalize.
      const linger = setTimeout(() => {
        // Trigger finalize on the server; do NOT change revealAnimating
        // here. We'll observe `roomStatus` and clear the flag when the
        // server-side state moves to 'finished'.
        finalizeReveal(roomId).catch(() => void 0);
      }, REVEAL_LINGER);
      return () => clearTimeout(linger);
    }

    // First card has shorter delay to avoid "frozen" impression
    const delay = revealIndex === 0 ? REVEAL_FIRST_DELAY : REVEAL_STEP_DELAY;
    const timer = setTimeout(() => {
      setRevealIndex((i) => {
        if (i >= orderListLength) return i;
        return i + 1;
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [revealAnimating, revealIndex, orderListLength, roomId]);

  // Turn off the local animation flag when the server reports finished.
  useEffect(() => {
    if (roomStatus === "finished") {
      setRevealAnimating(false);
    }
  }, [roomStatus]);

  return {
    revealAnimating,
    revealIndex,
  };
}
