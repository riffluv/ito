"use client";
import { useCallback, useEffect, useState } from "react";

export function useRevealGate(status: string | undefined | null, roomId?: string) {
  const [pending, setPending] = useState(false);

  // status が reveal/finished に到達したら自動解除
  useEffect(() => {
    if (status === "reveal" || status === "finished") {
      if (pending) setPending(false);
    }
  }, [status, pending]);

  const begin = useCallback(() => {
    setPending(true);
    try {
      if (typeof window !== "undefined") {
        const detail = roomId ? { roomId } : undefined;
        window.dispatchEvent(new CustomEvent("ito:local-reveal-begin", { detail }));
      }
    } catch {}
  }, [roomId]);

  const end = useCallback(() => setPending(false), []);

  const hideHandUI = pending || status === "reveal";

  return { hideHandUI, pending, begin, end } as const;
}
