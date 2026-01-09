import { PRESENCE_HEARTBEAT_MS } from "@/lib/constants/presence";
import {
  presenceSupported,
  subscribePresence,
} from "@/lib/firebase/presence";
import { logDebug } from "@/lib/utils/log";
import { setMetric } from "@/lib/utils/metrics";
import { scheduleIdleTask } from "@/lib/utils/idleScheduler";
import type { Dispatch, SetStateAction } from "react";

export function subscribePresenceOnlineUids(params: {
  roomId: string;
  uid: string | null;
  presenceHydratedRef: { current: boolean };
  onlineUidsSignatureRef: { current: string | null };
  presenceHydrationTimerRef: { current: ReturnType<typeof setTimeout> | null };
  setPresenceReady: Dispatch<SetStateAction<boolean>>;
  setPresenceDegraded: Dispatch<SetStateAction<boolean>>;
  setOnlineUids: Dispatch<SetStateAction<string[] | undefined>>;
}): () => void {
  const {
    roomId,
    uid,
    presenceHydratedRef,
    onlineUidsSignatureRef,
    presenceHydrationTimerRef,
    setPresenceReady,
    setPresenceDegraded,
    setOnlineUids,
  } = params;

  presenceHydratedRef.current = false;
  onlineUidsSignatureRef.current = null;
  if (presenceHydrationTimerRef.current) {
    clearTimeout(presenceHydrationTimerRef.current);
    presenceHydrationTimerRef.current = null;
  }
  let unsubscribe: (() => void) | null = null;

  const cleanup = () => {
    if (presenceHydrationTimerRef.current) {
      clearTimeout(presenceHydrationTimerRef.current);
      presenceHydrationTimerRef.current = null;
    }
    onlineUidsSignatureRef.current = null;
    setPresenceReady(false);
    setPresenceDegraded(!presenceSupported());
    setOnlineUids(undefined);
    unsubscribe?.();
  };

  const presenceAvailable = presenceSupported();
  if (!roomId || !uid || !presenceAvailable) {
    setPresenceReady(false);
    setPresenceDegraded(!presenceAvailable);
    setOnlineUids(undefined);
    return cleanup;
  }

  const markReady = (uids: string[]) => {
    const signature = [...uids].sort().join(",");
    if (
      presenceHydratedRef.current &&
      onlineUidsSignatureRef.current === signature
    ) {
      return;
    }
    onlineUidsSignatureRef.current = signature;
    presenceHydratedRef.current = true;
    setOnlineUids(uids);
    setPresenceReady(true);
    setMetric("participants", "onlineCount", Array.isArray(uids) ? uids.length : 0);
  };

  let cancelIdleSubscribe: (() => void) | null = null;
  cancelIdleSubscribe = scheduleIdleTask(
    () => {
      unsubscribe = subscribePresence(roomId, (uids) => {
        logDebug("presence", "update", { roomId, uids });
        if (!presenceHydratedRef.current && uids.length === 0) {
          if (!presenceHydrationTimerRef.current) {
            presenceHydrationTimerRef.current = setTimeout(() => {
              presenceHydrationTimerRef.current = null;
              markReady([]);
            }, PRESENCE_HEARTBEAT_MS);
          }
          return;
        }
        if (presenceHydrationTimerRef.current) {
          clearTimeout(presenceHydrationTimerRef.current);
          presenceHydrationTimerRef.current = null;
        }
        markReady(uids);
      });
    },
    { delayMs: 36, timeoutMs: 200 }
  );

  return () => {
    cancelIdleSubscribe?.();
    cleanup();
  };
}
