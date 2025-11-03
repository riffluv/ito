import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { notify } from "@/components/ui/notify";
import { cancelSeatRequest } from "@/lib/game/service";
import { leaveRoom as leaveRoomAction } from "@/lib/firebase/rooms";
import { forceDetachAll } from "@/lib/firebase/presence";
import { logDebug, logError } from "@/lib/utils/log";
import { bumpMetric } from "@/lib/utils/metrics";
import type {
  RoomMachineClientEvent,
  SpectatorReason as MachineSpectatorReason,
} from "@/lib/state/roomMachine";

interface UseForcedExitParams {
  uid: string | null;
  roomStatus: string | undefined;
  canAccess: boolean;
  loading: boolean;
  authLoading: boolean;
  rejoinSessionKey: string | null;
  autoJoinSuppressKey?: string | null;
  redirectGuard: boolean;
  lastKnownHostId: string | null;
  leavingRef: MutableRefObject<boolean>;
  detachNow: () => Promise<void> | void;
  setForcedExitReason: (reason: "game-in-progress" | null) => void;
  roomId: string;
  displayName?: string | null;
  sendRoomEvent?: (event: RoomMachineClientEvent) => void;
  fsmEnabled: boolean;
  recallOpen: boolean;
  skip?: boolean;
}

/**
 * プレイヤー・観戦者の強制退席処理をまとめたフック。
 * 強制退席がスケジュールされた場合は座席リクエストのクリーンアップと通知を行う。
 */
export function useForcedExit({
  uid,
  roomStatus,
  canAccess,
  loading,
  authLoading,
  rejoinSessionKey,
  autoJoinSuppressKey,
  redirectGuard,
  lastKnownHostId,
  leavingRef,
  detachNow,
  setForcedExitReason,
  roomId,
  displayName,
  sendRoomEvent,
  fsmEnabled,
  recallOpen,
  skip = false,
}: UseForcedExitParams) {
  const forcedExitScheduledRef = useRef(false);
  const forcedExitCleanupRef = useRef(false);
  const forcedExitNotifiedRef = useRef(false);
  const forcedExitReasonRef = useRef<MachineSpectatorReason | null>(null);
  const clearPendingRejoin = () => {
    if (!rejoinSessionKey) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(rejoinSessionKey);
    } catch (error) {
      logDebug("useForcedExit", "rejoin-session-clear-failed", error);
    }
  };

  const setAutoJoinSuppressed = () => {
    if (!autoJoinSuppressKey) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(autoJoinSuppressKey, "1");
    } catch (error) {
      logDebug("useForcedExit", "auto-join-suppress-failed", error);
    }
  };

  const clearAutoJoinSuppressed = () => {
    if (!autoJoinSuppressKey) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.removeItem(autoJoinSuppressKey);
    } catch (error) {
      logDebug("useForcedExit", "auto-join-unsuppress-failed", error);
    }
  };

  useEffect(() => {
    if (skip) {
      forcedExitScheduledRef.current = false;
      forcedExitCleanupRef.current = false;
      forcedExitNotifiedRef.current = false;
      forcedExitReasonRef.current = null;
      clearAutoJoinSuppressed();
      return;
    }
    if (!uid) return;
    if (leavingRef.current) return;
    if (lastKnownHostId === uid) return;
    // プレイヤー情報が揃うまで待つ
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

    const dispatchSpectatorForceExit = (reason: MachineSpectatorReason | null) => {
      if (!fsmEnabled) return;
      if (!sendRoomEvent) return;
      sendRoomEvent({ type: "SPECTATOR_FORCE_EXIT", reason });
    };

    const resolveForceExitReason = (): MachineSpectatorReason => {
      if (roomStatus !== "waiting") {
        return "mid-game";
      }
      return recallOpen ? "waiting-open" : "waiting-closed";
    };

    if (!canAccess) {
      const forceExitReason = resolveForceExitReason();

      if (!forcedExitScheduledRef.current) {
        forcedExitScheduledRef.current = true;
      }
      setAutoJoinSuppressed();
      if (forcedExitReasonRef.current === null) {
        forcedExitReasonRef.current = forceExitReason;
      }

      if (roomStatus !== "waiting") {
        if (!forcedExitNotifiedRef.current) {
          forcedExitNotifiedRef.current = true;
          try {
            notify({
              title: "観戦枠が閉じられました",
              description: "ホストの操作が完了するまで、再入室はしばらくお待ちください。",
              type: "info",
            });
          } catch (error) {
            logDebug("room-page", "notify-force-exit-init-failed", error);
          }
          bumpMetric("forcedExit", "gameInProgress");
        }
        dispatchSpectatorForceExit(forceExitReason);
        if (uid) {
          void cancelSeatRequest(roomId, uid)
            .then(() => {
              clearPendingRejoin();
            })
            .catch((error) => {
              logDebug("useForcedExit", "manual-force-exit-cancel-seat-request", error);
            });
        }
        setForcedExitReason("game-in-progress");
        return;
      }

      if (!forcedExitCleanupRef.current) {
        forcedExitCleanupRef.current = true;
        const runCleanup = async () => {
          leavingRef.current = true;
          if (uid) {
            try {
              await cancelSeatRequest(roomId, uid);
              clearPendingRejoin();
            } catch (error) {
              logDebug("useForcedExit", "auto-cancel-seat-request-failed", error);
            }
          }
          setAutoJoinSuppressed();
          const cleanupReason = forcedExitReasonRef.current ?? forceExitReason;
          dispatchSpectatorForceExit(cleanupReason);
          try {
            await detachNow();
          } catch (error) {
            logDebug("useForcedExit", "auto-detach-failed", error);
          }
          try {
            await forceDetachAll(roomId, uid);
          } catch (error) {
            logDebug("useForcedExit", "auto-force-detach-failed", error);
          }
          await leaveRoomAction(roomId, uid, displayName ?? null);
        };
        runCleanup()
          .catch((error) => {
            logError("useForcedExit", "auto-leave-failed", error);
          })
          .finally(() => {
            forcedExitCleanupRef.current = false;
            forcedExitReasonRef.current = null;
          });
      }
      return;
    }

    if ((canAccess || roomStatus === "waiting") && forcedExitScheduledRef.current) {
      forcedExitScheduledRef.current = false;
      forcedExitNotifiedRef.current = false;
      clearAutoJoinSuppressed();
      // 注意: forcedExitReason は page.tsx 側の自動再参加ロジックが参照するためここではクリアしない
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
    setForcedExitReason,
    roomId,
    displayName,
    detachNow,
    sendRoomEvent,
    fsmEnabled,
    recallOpen,
    skip,
    autoJoinSuppressKey,
  ]);
}






