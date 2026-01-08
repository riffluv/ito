"use client";

import React from "react";

type RevealAnimatingEvent = CustomEvent<{
  roomId?: string;
  animating?: boolean;
}>;
const noopCleanup = () => {};

export function useRevealAnimatingState(roomId: string, roomStatus?: string) {
  const [isRevealAnimating, setIsRevealAnimating] = React.useState(
    roomStatus === "reveal"
  );

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return noopCleanup;
    }

    const handleRevealAnimating: EventListener = (event) => {
      const detail = (event as RevealAnimatingEvent).detail;
      if (!detail) return;
      if (detail.roomId && detail.roomId !== roomId) return;
      setIsRevealAnimating(Boolean(detail.animating));
    };

    window.addEventListener("ito:reveal-animating", handleRevealAnimating);
    return () => {
      window.removeEventListener("ito:reveal-animating", handleRevealAnimating);
    };
  }, [roomId]);

  React.useEffect(() => {
    if (roomStatus === "reveal") {
      setIsRevealAnimating(true);
    } else {
      setIsRevealAnimating(false);
    }
  }, [roomStatus]);

  return isRevealAnimating;
}
