"use client";
import { PRESENCE_DISAPPEAR_GRACE_MS } from "@/lib/constants/uiTimings";
import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_HEARTBEAT_RETRY_DELAYS_MS,
} from "@/lib/constants/presence";
import { attachPresence, presenceSupported } from "@/lib/firebase/presence";
import { deriveStableOnlineUids } from "@/lib/presence/stableOnline";
import type { PlayerDoc } from "@/lib/types";
import { reportOpsEvent } from "@/lib/telemetry/opsMonitoring";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  deriveEffectiveOnlineUids,
  deriveParticipants,
} from "@/lib/hooks/participants/deriveParticipants";
import {
  readMissingSinceStore,
  writeMissingSinceStore,
} from "@/lib/hooks/participants/missingSinceStore";
import { subscribePresenceOnlineUids } from "@/lib/hooks/participants/subscribePresenceOnlineUids";
import { subscribePlayersFirestore } from "@/lib/hooks/participants/subscribePlayersFirestore";

export type ParticipantsState = {
  players: (PlayerDoc & { id: string })[];
  onlineUids?: string[]; // presence 未整備時は undefined（安定化済み）
  stableOnlineUids?: string[];
  presenceReady: boolean;
  presenceDegraded: boolean;
  participants: (PlayerDoc & { id: string })[]; // players ∩ online
  detach: () => Promise<void> | void; // 明示的退出時に使用
  reattachNow: () => Promise<void>; // 観戦→復帰などで presence を再接続
  loading: boolean;
  error: Error | null;
};

const isPromiseLike = <T = unknown>(value: unknown): value is Promise<T> => {
  return (
    typeof value === "object" &&
    value !== null &&
    "then" in value &&
    typeof (value as Promise<T>).then === "function" &&
    "catch" in value &&
    typeof (value as Promise<T>).catch === "function"
  );
};

export function useParticipants(
  roomId: string,
  uid: string | null
): ParticipantsState {
  const [players, setPlayers] = useState<(PlayerDoc & { id: string })[]>([]);
  const [onlineUids, setOnlineUids] = useState<string[] | undefined>(undefined);
  const onlineUidsSignatureRef = useRef<string | null>(null);
  const [stableOnlineUids, setStableOnlineUids] = useState<string[] | undefined>(
    undefined
  );
  const stableOnlineUidsRef = useRef<string[] | undefined>(undefined);
  const [presenceReady, setPresenceReady] = useState(false);
  const [presenceDegraded, setPresenceDegraded] = useState(false);
  const lastPresenceDegradedRef = useRef<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const detachRef = useRef<null | (() => Promise<void> | void)>(null);
  const activePresenceRef = useRef<{ roomId: string | null; uid: string | null }>({
    roomId: null,
    uid: null,
  });
  const attachRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reattachTriggerRef = useRef<(() => void) | null>(null);
  const playersRef = useRef<(PlayerDoc & { id: string })[]>([]);
  const playersSignatureRef = useRef<string>("");
  const presenceStallTimerRef = useRef<number | null>(null);

  // Firestore: players 購読（タブ非表示時は遅延開始、429時はバックオフ）
  // auth 未確定のタイミングで購読すると permission-denied で購読が死ぬ可能性があるため、
  // uid が確定してから購読を開始する。
  useEffect(() => {
    return subscribePlayersFirestore({
      roomId,
      uid,
      setPlayers,
      setLoading,
      setError,
      playersRef,
      playersSignatureRef,
    });
  }, [roomId, uid]);

  const presenceHydratedRef = useRef(false);
  const presenceHydrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // RTDB: presence 購読
  // auth 未確定のタイミングで購読すると permission-denied で購読が死ぬ可能性があるため、
  // uid が確定してから購読を開始する。
  useEffect(() => {
    return subscribePresenceOnlineUids({
      roomId,
      uid,
      presenceHydratedRef,
      onlineUidsSignatureRef,
      presenceHydrationTimerRef,
      setPresenceReady,
      setPresenceDegraded,
      setOnlineUids,
    });
  }, [roomId, uid]);

  // 自分の presence アタッチ/デタッチ
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

  useEffect(() => {
    let cancelled = false;
    const cleanup = () => {
      cancelled = true;
      reattachTriggerRef.current = null;
    };

    if (!presenceSupported()) {
      clearAttachRetryTimer();
      reattachTriggerRef.current = null;
      if (detachRef.current) {
        try {
          const maybePromise = detachRef.current();
          if (isPromiseLike(maybePromise)) {
            maybePromise.catch(() => void 0);
          }
        } catch {}
        detachRef.current = null;
      }
      activePresenceRef.current = { roomId: null, uid: null };
      return cleanup;
    }

    reattachTriggerRef.current = null;

    const handleDetachIfNeeded = async () => {
      const prev = activePresenceRef.current;
      const roomChanged = prev.roomId !== (roomId ?? null);
      const uidChanged = prev.uid !== (uid ?? null);

      if (detachRef.current && (roomChanged || uidChanged || !roomId || !uid)) {
        try {
          await detachRef.current();
        } catch {}
        if (!cancelled) {
          detachRef.current = null;
        }
      }

      if (!roomId || !uid) {
        if (!cancelled) {
          activePresenceRef.current = { roomId: roomId ?? null, uid: uid ?? null };
        }
      }
    };

    const attachDelays = [0, ...PRESENCE_HEARTBEAT_RETRY_DELAYS_MS];

    const tryAttach = async (attempt = 0) => {
      if (cancelled) return;
      if (!roomId || !uid) return;
      if (detachRef.current) {
        activePresenceRef.current = { roomId, uid };
        return;
      }

      try {
        const detach = await attachPresence(roomId, uid);
        if (cancelled) {
          try {
            await detach();
          } catch {}
          return;
        }
        clearAttachRetryTimer();
        detachRef.current = detach;
        activePresenceRef.current = { roomId, uid };
      } catch {
        const nextAttempt = attempt + 1;
        const delay =
          attachDelays[
            Math.min(nextAttempt, attachDelays.length - 1)
          ];
        clearAttachRetryTimer();
        attachRetryTimerRef.current = setTimeout(
          () => {
            tryAttach(nextAttempt);
          },
          delay
        );
      }
    };

    reattachTriggerRef.current = () => {
      if (cancelled) return;
      clearAttachRetryTimer();
      void tryAttach(0);
    };

    handleDetachIfNeeded().finally(() => {
      if (!cancelled && roomId && uid) {
        clearAttachRetryTimer();
        tryAttach(0);
      }
    });

    return cleanup;
  }, [roomId, uid]);

  useEffect(() => {
    let handle: number | null = null;
    const clearExistingTimer = () => {
      if (presenceStallTimerRef.current !== null) {
        window.clearTimeout(presenceStallTimerRef.current);
        presenceStallTimerRef.current = null;
      }
    };
    const cleanup = () => {
      if (handle !== null && presenceStallTimerRef.current === handle) {
        window.clearTimeout(handle);
        presenceStallTimerRef.current = null;
      }
    };
    if (!presenceSupported()) {
      clearExistingTimer();
      setPresenceDegraded(false);
      return cleanup;
    }
    if (!roomId) {
      setPresenceDegraded(false);
      clearExistingTimer();
      return cleanup;
    }
    if (presenceReady) {
      setPresenceDegraded(false);
      clearExistingTimer();
      return cleanup;
    }
    if (presenceStallTimerRef.current !== null) {
      return cleanup;
    }
    handle = window.setTimeout(() => {
      presenceStallTimerRef.current = null;
      setPresenceDegraded(true);
    }, PRESENCE_HEARTBEAT_MS * 2);
    presenceStallTimerRef.current = handle;
    return cleanup;
  }, [presenceReady, roomId]);

  useEffect(() => {
    if (lastPresenceDegradedRef.current === presenceDegraded) return;
    if (presenceDegraded) {
      reportOpsEvent({
        name: "presence.degraded",
        metric: "ops.presence.degraded",
        level: "warning",
        tags: { state: "degraded" },
        extra: { roomId },
      });
    } else if (lastPresenceDegradedRef.current !== null) {
      reportOpsEvent({
        name: "presence.recovered",
        metric: "ops.presence.recovered",
        level: "info",
        tags: { state: "ok" },
        extra: { roomId },
      });
    }
    lastPresenceDegradedRef.current = presenceDegraded;
  }, [presenceDegraded, roomId]);

  // アンマウント時のデタッチ
  useEffect(() => {
    return () => {
      try {
        const result = detachRef.current?.();
        if (isPromiseLike(result)) {
          result.catch(() => void 0);
        }
      } catch {}
    };
  }, []);

  // ルーム変更/アンマウント時に presence グレースキャッシュを掃除
  useEffect(() => {
    return () => {
      if (typeof window === "undefined" || !roomId) return;
      try {
        if (window.__missingSince) {
          delete window.__missingSince[roomId];
        }
      } catch {}
    };
  }, [roomId]);

  useEffect(() => {
    if (!presenceReady || !Array.isArray(onlineUids)) {
      setStableOnlineUids(undefined);
      stableOnlineUidsRef.current = undefined;
      return;
    }

    const { stable, missingSince } = deriveStableOnlineUids({
      onlineUids,
      previousStable: stableOnlineUidsRef.current ?? onlineUids,
      missingSince: readMissingSinceStore(roomId),
      now: Date.now(),
      graceMs: PRESENCE_DISAPPEAR_GRACE_MS,
    });

    setStableOnlineUids(stable);
    stableOnlineUidsRef.current = stable;
    if (roomId) {
      writeMissingSinceStore(roomId, missingSince);
    }
  }, [presenceReady, onlineUids, roomId]);

  const effectiveOnlineUids = useMemo(
    () =>
      deriveEffectiveOnlineUids({
        presenceReady,
        presenceDegraded,
        onlineUids,
        stableOnlineUids,
      }),
    [onlineUids, presenceDegraded, presenceReady, stableOnlineUids]
  );

  const participants = useMemo(
    () =>
      deriveParticipants({
        players,
        effectiveOnlineUids,
        presenceReady,
        presenceDegraded,
      }),
    [effectiveOnlineUids, players, presenceDegraded, presenceReady]
  );

  useEffect(() => {
    setMetric("participants", "activeCount", participants.length);
  }, [participants.length]);

  useEffect(() => {
    setMetric("participants", "presenceReady", presenceReady ? 1 : 0);
  }, [presenceReady]);

  const prevOnlineUidsRef = useRef<string[]>([]);
  useEffect(() => {
    if (!presenceReady || !roomId) return;
    if (!Array.isArray(onlineUids)) return;
    const prev = prevOnlineUidsRef.current;
    const joined = onlineUids.filter((onlineUid) => !prev.includes(onlineUid));
    const left = prev.filter((previousUid) => !onlineUids.includes(previousUid));
    if (joined.length || left.length) {
      traceAction("presence.change", {
        roomId,
        joined,
        left,
        onlineCount: onlineUids.length,
      });
    }
    prevOnlineUidsRef.current = [...onlineUids];
  }, [presenceReady, roomId, onlineUids]);

  const detach = async () => {
    const current = detachRef.current;
    detachRef.current = null;
    activePresenceRef.current = { roomId: null, uid: null };
    if (!current) return;
    try {
      const maybeResult = current();
      if (isPromiseLike(maybeResult)) {
        await maybeResult.catch(() => void 0);
      }
    } catch {}
  };

  const reattachNow = async () => {
    await detach();
    const trigger = reattachTriggerRef.current;
    if (trigger) {
      try {
        trigger();
      } catch {}
    }
  };

  return {
    players,
    onlineUids: effectiveOnlineUids,
    stableOnlineUids,
    presenceReady,
    presenceDegraded,
    participants,
    detach,
    reattachNow,
    loading,
    error,
  };
}
