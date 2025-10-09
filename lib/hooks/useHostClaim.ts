import { useEffect, useRef } from "react";
import type { User } from "firebase/auth";
import { logError, logDebug } from "@/lib/utils/log";

interface UseHostClaimParams {
  roomId: string;
  uid: string | null;
  user: User | null;
  hostId: string | null;
  candidateId: string | null;
  lastKnownHostId: string | null;
  previousHostStillMember: boolean;
  isMember: boolean;
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
  isMember,
  leavingRef,
}: UseHostClaimParams) {
  const hostClaimTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hostClaimAttemptRef = useRef<number>(0);
  const hostClaimPostSuccessRef = useRef<number>(0);

  useEffect(() => {
    const clearTimer = () => {
      if (hostClaimTimerRef.current) {
        clearTimeout(hostClaimTimerRef.current);
        hostClaimTimerRef.current = null;
      }
    };

    const scheduleRetry = (delay: number) => {
      if (hostClaimTimerRef.current) {
        clearTimeout(hostClaimTimerRef.current);
      }
      hostClaimTimerRef.current = setTimeout(() => {
        hostClaimTimerRef.current = null;
        if (!cancelled) {
          void attemptClaim();
        }
      }, delay);
    };

    // ホストが存在する、または基本条件を満たさない
    if (!uid || !user || hostId || leavingRef.current) {
      clearTimer();
      return clearTimer;
    }

    if (!isMember) {
      clearTimer();
      return clearTimer;
    }

    // 自分が候補者でない、または前のホストがまだメンバー
    const isDesignatedCandidate = candidateId === uid;
    const isRecoveringHost =
      lastKnownHostId === uid && !previousHostStillMember;
    const hasNoRecordedHost = !candidateId && !lastKnownHostId;
    const isSelfFallback =
      lastKnownHostId === uid && (!candidateId || candidateId === uid);
    const shouldAttemptClaim =
      (isDesignatedCandidate ||
        isRecoveringHost ||
        hasNoRecordedHost ||
        isSelfFallback) &&
      (!lastKnownHostId || lastKnownHostId === uid || !previousHostStillMember);

    logDebug(
      "room-page",
      "claim-host evaluate " +
        JSON.stringify({
          roomId,
          uid,
          hostId,
          candidateId,
          lastKnownHostId,
          previousHostStillMember,
          isMember,
          leaving: leavingRef.current,
        })
    );

    if (!shouldAttemptClaim) {
      logDebug(
        "room-page",
        "claim-host skipped " +
          JSON.stringify({
            roomId,
            uid,
            candidateId,
            lastKnownHostId,
            previousHostStillMember,
            isMember,
            leaving: leavingRef.current,
          })
      );
      hostClaimPostSuccessRef.current = 0;
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

        const response = await fetch(`/api/rooms/${roomId}/claim-host`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, token }),
          keepalive: true,
        });

        let detail: unknown = null;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          detail = await response.json().catch(() => null);
        }

        const payload =
          typeof detail === "object" && detail !== null
            ? (detail as Record<string, unknown>)
            : null;
        const bodyOk = payload && "ok" in payload ? Boolean(payload.ok) : true;

        if (!response.ok || !bodyOk) {
          const error = new Error(
            `claim-host failed: status=${response.status}`
          );
          (error as any).status = response.status;
          (error as any).detail = detail;
          throw error;
        }
        hostClaimAttemptRef.current = 0;
        logDebug(
          "room-page",
          "claim-host success " +
            JSON.stringify({
              roomId,
              uid,
              attempts: hostClaimAttemptRef.current,
            })
        );
        if (!hostId || String(hostId).trim().length === 0) {
          const retryCount = hostClaimPostSuccessRef.current + 1;
          if (retryCount <= 3) {
            hostClaimPostSuccessRef.current = retryCount;
            const delay = 600 * Math.pow(2, retryCount - 1);
            scheduleRetry(delay);
          }
        } else {
          hostClaimPostSuccessRef.current = 0;
        }
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
    isMember,
    roomId,
    leavingRef,
  ]);
}
