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

  // Start reveal animation（堅牢化: 初回マウント時にrevealでも開始）
  useEffect(() => {
    const prev = prevStatusRef.current;
    const becameReveal = prev !== "reveal" && roomStatus === "reveal";
    const isRevealNow = roomStatus === "reveal";
    const shouldStart =
      resolveMode === "sort-submit" && orderListLength > 0 &&
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
      setRevealAnimating(false);
      // 余韻: 最後にめくってから1.2秒後にfinishedへ
      const linger = setTimeout(() => {
        finalizeReveal(roomId).catch(() => void 0);
      }, 1200);
      return () => clearTimeout(linger);
      return;
    }
    
    // First card has shorter delay to avoid "frozen" impression
    const delay = revealIndex === 0 ? 600 : 1500; // ms (最初短く→以降ゆっくり)
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
