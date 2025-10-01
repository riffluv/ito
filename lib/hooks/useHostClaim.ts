import { useEffect, useRef } from "react";
import type { User } from "firebase/auth";
import { logError } from "@/lib/utils/log";

interface UseHostClaimParams {
  roomId: string;
  uid: string | null;
  user: User | null;
  hostId: string | null;
  candidateId: string | null;
  lastKnownHostId: string | null;
  previousHostStillMember: boolean;
  leavingRef: React.MutableRefObject<boolean>;
}

/**
 * ⚡ PERFORMANCE: 88行の巨大useEffectをカスタムフック化
 * ホストが不在の場合、候補者が自動的にホスト権限をクレームする
 */
export function useHostClaim({
  roomId,
  uid,
  user,
  hostId,
  candidateId,
  lastKnownHostId,
  previousHostStillMember,
  leavingRef,
}: UseHostClaimParams) {
  const hostClaimTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hostClaimAttemptRef = useRef<number>(0);

  useEffect(() => {
    const clearTimer = () => {
      if (hostClaimTimerRef.current) {
        clearTimeout(hostClaimTimerRef.current);
        hostClaimTimerRef.current = null;
      }
    };

    // ホストが存在する、または基本条件を満たさない
    if (!uid || !user || hostId || leavingRef.current) {
      clearTimer();
      return clearTimer;
    }

    // 自分が候補者でない、または前のホストがまだメンバー
    const shouldAttemptClaim =
      candidateId === uid &&
      (!lastKnownHostId || lastKnownHostId === uid || !previousHostStillMember);

    if (!shouldAttemptClaim) {
      clearTimer();
      return clearTimer;
    }

    let cancelled = false;

    const attemptClaim = async () => {
      try {
        const token = await user.getIdToken();
        if (!token || cancelled) {
          return;
        }

        await fetch(`/api/rooms/${roomId}/claim-host`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, token }),
          keepalive: true,
        });
        hostClaimAttemptRef.current = 0;
      } catch (error) {
        logError("room-page", "claim-host", error);
        if (!cancelled) {
          const attempt = hostClaimAttemptRef.current + 1;
          if (attempt <= 3) {
            hostClaimAttemptRef.current = attempt;
            const delay = 800 * Math.pow(2, attempt - 1);
            clearTimer();
            hostClaimTimerRef.current = setTimeout(() => {
              hostClaimTimerRef.current = null;
              if (!cancelled) {
                void attemptClaim();
              }
            }, delay);
          }
        }
      }
    };

    attemptClaim();

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [
    uid,
    user,
    hostId,
    candidateId,
    lastKnownHostId,
    previousHostStillMember,
    roomId,
    leavingRef,
  ]);
}
