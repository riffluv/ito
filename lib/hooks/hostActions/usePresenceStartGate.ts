import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { notify } from "@/components/ui/notify";
import { PRESENCE_FORCE_START_AFTER_MS } from "@/lib/constants/presence";
import { toastIds } from "@/lib/ui/toastIds";
import { traceAction } from "@/lib/utils/trace";

export function usePresenceStartGate(params: {
  roomId: string;
  presenceReady: boolean;
  presenceDegraded: boolean;
  playerCount?: number;
}): {
  presenceForceEligible: boolean;
  presenceCanStart: boolean;
  presenceWaitRemainingMs: number;
  ensurePresenceReady: () => boolean;
} {
  const { roomId, presenceReady, presenceDegraded, playerCount } = params;

  const presenceWarningShownRef = useRef(false);
  const presenceWaitSinceRef = useRef<number | null>(null);
  const [presenceWaitedMs, setPresenceWaitedMs] = useState(0);

  // presence の初期同期が遅延した場合の待ち時間を計測し、一定時間で強制開始を許可する。
  useEffect(() => {
    if (typeof window === "undefined") {
      return () => {};
    }
    if (presenceReady || presenceDegraded) {
      presenceWaitSinceRef.current = null;
      setPresenceWaitedMs(0);
      return () => {};
    }
    if (presenceWaitSinceRef.current === null) {
      presenceWaitSinceRef.current = Date.now();
    }
    const tick = () => {
      const since = presenceWaitSinceRef.current;
      if (since === null) return;
      setPresenceWaitedMs(Date.now() - since);
    };
    tick();
    const handle = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(handle);
    };
  }, [presenceReady, presenceDegraded, roomId]);

  const presenceForceEligible =
    !presenceReady && !presenceDegraded && presenceWaitedMs >= PRESENCE_FORCE_START_AFTER_MS;
  const presenceCanStart = presenceReady || presenceDegraded || presenceForceEligible;
  const presenceWaitRemainingMs = useMemo(() => {
    if (presenceCanStart) return 0;
    return Math.max(PRESENCE_FORCE_START_AFTER_MS - presenceWaitedMs, 0);
  }, [presenceCanStart, presenceWaitedMs]);

  const ensurePresenceReady = useCallback(() => {
    if (presenceReady) {
      return true;
    }
    const forceAllowed = presenceForceEligible;
    if (presenceDegraded === true || forceAllowed) {
      if (!presenceWarningShownRef.current) {
        notify({
          id: toastIds.genericInfo(roomId, "presence-warn"),
          title: "接続状況を確認できません",
          description: "プレイヤー一覧をもとに開始を続行します。",
          type: "info",
          duration: 2400,
        });
        presenceWarningShownRef.current = true;
      }
      traceAction("ui.host.presence.degraded", {
        roomId,
        ready: presenceReady ? "1" : "0",
        degraded: presenceDegraded ? "1" : "0",
        forced: forceAllowed ? "1" : "0",
        waitedMs: Math.round(presenceWaitedMs),
        players: typeof playerCount === "number" ? playerCount : -1,
      });
      return true;
    }

    traceAction("ui.host.presence.wait", {
      roomId,
      waitedMs: Math.round(presenceWaitedMs),
    });
    notify({
      id: toastIds.genericInfo(roomId, "presence-wait"),
      title: "参加者の接続を待っています",
      description: "全員のオンライン状態が揃うまで数秒お待ちください。",
      type: "info",
      duration: 2000,
    });
    return false;
  }, [playerCount, presenceDegraded, presenceForceEligible, presenceReady, presenceWaitedMs, roomId]);

  useEffect(() => {
    presenceWarningShownRef.current = false;
  }, [roomId]);

  return { presenceForceEligible, presenceCanStart, presenceWaitRemainingMs, ensurePresenceReady };
}

