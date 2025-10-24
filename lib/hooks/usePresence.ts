import {
  attachPresence,
  presenceSupported,
  subscribePresence,
} from "@/lib/firebase/presence";
import { PRESENCE_HEARTBEAT_RETRY_DELAYS_MS } from "@/lib/constants/presence";
import { useEffect, useRef, useState } from "react";

export function usePresence(roomId: string, userId: string | null) {
  const [onlineUids, setOnlineUids] = useState<string[] | undefined>(undefined);
  const detachRef = useRef<null | (() => Promise<void> | void)>(null);
  const attachRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe online list (only when presence supported and user ready)
  useEffect(() => {
    if (!presenceSupported()) return;
    if (!roomId) return;
    const off = subscribePresence(roomId, (uids) => setOnlineUids(uids));
    return () => off();
  }, [roomId]);

  const clearAttachRetryTimer = () => {
    if (attachRetryTimerRef.current) {
      try {
        clearTimeout(attachRetryTimerRef.current);
      } catch {}
      attachRetryTimerRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearAttachRetryTimer();
    },
    []
  );

  // Attach/detach my presence as soon as userId is available
  useEffect(() => {
    if (!presenceSupported()) return;
    let cancelled = false;

    const attachDelays = [0, ...PRESENCE_HEARTBEAT_RETRY_DELAYS_MS];

    const tryAttach = async (attempt = 0) => {
      if (cancelled) return;

      if (userId) {
        if (detachRef.current) return;
        try {
          const detach = await attachPresence(roomId, userId);
          if (cancelled) {
            try {
              await detach();
            } catch {}
            return;
          }
          clearAttachRetryTimer();
          detachRef.current = detach;
        } catch {
          const nextAttempt = attempt + 1;
          const delay =
            attachDelays[
              Math.min(nextAttempt, attachDelays.length - 1)
            ];
          clearAttachRetryTimer();
          attachRetryTimerRef.current = setTimeout(
            () => tryAttach(nextAttempt),
            delay
          );
        }
      } else if (detachRef.current) {
        try {
          await detachRef.current();
        } catch {}
        if (!cancelled) {
          detachRef.current = null;
        }
      }
    };

    clearAttachRetryTimer();
    tryAttach(0);

    return () => {
      cancelled = true;
    };
  }, [roomId, userId]);

  // Ensure detach on unmount
  useEffect(() => {
    return () => {
      try {
        const r = detachRef.current?.();
        if (r && typeof (r as any).then === "function")
          (r as Promise<void>).catch(() => {});
      } catch {}
    };
  }, []);

  const detachNow = async () => {
    try {
      const r = detachRef.current?.();
      if (r && typeof (r as any).then === "function")
        await (r as Promise<void>);
    } catch {}
  };
  return { onlineUids, detachNow };
}
