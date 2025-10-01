import { useEffect, useRef } from "react";
import { notify } from "@/components/ui/notify";
import { logDebug } from "@/lib/utils/log";

interface UseForcedExitParams {
  uid: string | null;
  roomStatus: string | undefined;
  canAccess: boolean;
  loading: boolean;
  authLoading: boolean;
  rejoinSessionKey: string | null;
  redirectGuard: boolean;
  lastKnownHostId: string | null;
  leavingRef: React.MutableRefObject<boolean>;
  setPendingRejoinFlag: () => void;
  setForcedExitReason: (reason: "game-in-progress" | null) => void;
}

/**
 * ⚡ PERFORMANCE: 37行の強制退出処理をカスタムフック化
 * ゲーム進行中の部屋にアクセスできない場合に強制退出
 */
export function useForcedExit({
  uid,
  roomStatus,
  canAccess,
  loading,
  authLoading,
  rejoinSessionKey,
  redirectGuard,
  lastKnownHostId,
  leavingRef,
  setPendingRejoinFlag,
  setForcedExitReason,
}: UseForcedExitParams) {
  const forcedExitScheduledRef = useRef(false);

  useEffect(() => {
    if (!uid) return;
    if (leavingRef.current) return;
    if (lastKnownHostId === uid) return;
    // プレイヤー状態が変わる間に焦って抜けない(ハードリダイレクト防止)
    // F5リロード時にAuthContextとuseRoomStateの両方が安定するまで待つ
    if (loading || authLoading) return;
    if (redirectGuard) return;

    let pendingRejoin = false;
    if (rejoinSessionKey && typeof window !== "undefined") {
      try {
        pendingRejoin = window.sessionStorage.getItem(rejoinSessionKey) === uid;
      } catch (error) {
        logDebug("room-page", "session-storage-read-failed", error);
      }
    }
    if (pendingRejoin) return;

    if (!canAccess && roomStatus !== "waiting") {
      // ゲーム進行中 → 観戦モード
      if (!forcedExitScheduledRef.current) {
        forcedExitScheduledRef.current = true;
        setPendingRejoinFlag();
        try {
          notify({
            title: "ゲーム進行中です",
            description:
              "今回はプレイヤーとして残ることができません。ホストがリセットすると再参加できます。",
            type: "info",
          });
        } catch (error) {
          logDebug("room-page", "notify-force-exit-init-failed", error);
        }
        setForcedExitReason("game-in-progress");
      }
    }

    // waiting状態に戻った、またはアクセス可能になった → 観戦パネルをクリア
    if ((canAccess || roomStatus === "waiting") && forcedExitScheduledRef.current) {
      forcedExitScheduledRef.current = false;
      // 注意: forcedExitReasonはクリアしない（page.tsxの自動再参加ロジックが動作するため）
    }
  }, [
    roomStatus,
    uid,
    canAccess,
    loading,
    authLoading,
    rejoinSessionKey,
    redirectGuard,
    lastKnownHostId,
    leavingRef,
    setPendingRejoinFlag,
    setForcedExitReason,
  ]);
}
