import { useEffect, type MutableRefObject } from "react";

import { db } from "@/lib/firebase/client";

export function usePendingVisibilityKick(params: {
  roomId: string;
  latestRoomStatusRef: MutableRefObject<string | undefined>;
  quickStartPendingRef: MutableRefObject<boolean>;
  isRestartingRef: MutableRefObject<boolean>;
  pendingVisibilityKickAtRef: MutableRefObject<number>;
}): void {
  const {
    roomId,
    latestRoomStatusRef,
    quickStartPendingRef,
    isRestartingRef,
    pendingVisibilityKickAtRef,
  } = params;

  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const handler = () => {
      try {
        if (document.visibilityState !== "visible") return;
        if (!db) return;
        if (latestRoomStatusRef.current === "clue") return;
        if (!quickStartPendingRef.current && !isRestartingRef.current) return;
        const now = Date.now();
        if (now - pendingVisibilityKickAtRef.current < 1200) return;
        pendingVisibilityKickAtRef.current = now;
        window.dispatchEvent(
          new CustomEvent("ito:room-force-refresh", {
            detail: { roomId, reason: "host.pending.visibility" },
          })
        );
      } catch {}
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [
    isRestartingRef,
    latestRoomStatusRef,
    pendingVisibilityKickAtRef,
    quickStartPendingRef,
    roomId,
  ]);
}

