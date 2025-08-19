import { useEffect, useRef, useState } from "react";
import { presenceSupported, attachPresence, subscribePresence } from "@/lib/firebase/presence";

export function usePresence(roomId: string, userId: string | null, isMember: boolean) {
  const [onlineUids, setOnlineUids] = useState<string[] | undefined>(undefined);
  const detachRef = useRef<null | (() => Promise<void> | void)>(null);

  // Subscribe online list (only when presence supported and user ready)
  useEffect(() => {
    if (!presenceSupported()) return;
    if (!roomId) return;
    const off = subscribePresence(roomId, (uids) => setOnlineUids(uids));
    return () => off();
  }, [roomId]);

  // Attach/detach my presence when I'm a member
  useEffect(() => {
    if (!presenceSupported()) return;
    let cancelled = false;
    (async () => {
      try {
        if (userId && isMember) {
          if (!detachRef.current) {
            const detach = await attachPresence(roomId, userId);
            if (!cancelled) detachRef.current = detach;
          }
        } else if (detachRef.current) {
          await detachRef.current();
          if (!cancelled) detachRef.current = null;
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [roomId, userId, isMember]);

  // Ensure detach on unmount
  useEffect(() => {
    return () => { try { const r = detachRef.current?.(); if (r && typeof (r as any).then === "function") (r as Promise<void>).catch(()=>{}); } catch {} };
  }, []);

  const detachNow = async () => { try { const r = detachRef.current?.(); if (r && typeof (r as any).then === "function") await (r as Promise<void>); } catch {} };
  return { onlineUids, detachNow };
}
