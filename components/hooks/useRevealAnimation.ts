import { useEffect, useRef, useState } from "react";
import { finalizeReveal } from "@/lib/game/room";

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

  // Start reveal animation when transitioning from clue to reveal
  useEffect(() => {
    const prev = prevStatusRef.current;
    const startedReveal =
      resolveMode === "sort-submit" &&
      prev === "clue" &&
      roomStatus === "reveal" &&
      orderListLength > 0;
    
    if (startedReveal) {
      setRevealAnimating(true);
      setRevealIndex(0);
    }
    prevStatusRef.current = roomStatus;
  }, [roomStatus, resolveMode, orderListLength]);

  // Handle reveal animation progression
  useEffect(() => {
    if (!revealAnimating) return;
    
    if (revealIndex >= orderListLength) {
      setRevealAnimating(false);
      finalizeReveal(roomId).catch(() => void 0);
      return;
    }
    
    // First card has shorter delay to avoid "frozen" impression
    const delay = revealIndex === 0 ? 120 : 800; // ms
    const timer = setTimeout(() => {
      setRevealIndex((i) => {
        if (i >= orderListLength) return i;
        return i + 1;
      });
    }, delay);
    
    return () => clearTimeout(timer);
  }, [revealAnimating, revealIndex, orderListLength, roomId]);

  return {
    revealAnimating,
    revealIndex,
  };
}