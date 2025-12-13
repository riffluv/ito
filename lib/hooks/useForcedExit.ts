import { useEffect, useRef, type MutableRefObject } from "react";
import { notify } from "@/components/ui/notify";
import { leaveRoom as leaveRoomAction } from "@/lib/firebase/rooms";
import { logSpectatorForceExitDetected, logSpectatorForceExitCleanup, logSpectatorForceExitRecovered } from "@/lib/spectator/telemetry";
import { logDebug, logError } from "@/lib/utils/log";
import { bumpMetric } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";
import type {
  RoomMachineClientEvent,
  SpectatorReason as MachineSpectatorReason,
  SpectatorStatus,
} from "@/lib/state/roomMachine";

interface UseForcedExitParams {
  uid: string | null;
  roomStatus: string | undefined;
  canAccess: boolean;
  spectatorNode: SpectatorStatus;
  loading: boolean;
  authLoading: boolean;
  hasRejoinIntent: () => boolean;
  clearRejoinIntent: () => void;
  suppressAutoJoinIntent: () => void;
  cancelSeatRequestSafely: () => Promise<boolean>;
  redirectGuard: boolean;
  lastKnownHostId: string | null;
  leavingRef: MutableRefObject<boolean>;
  detachNow: () => Promise<void> | void;
  setForcedExitReason: (reason: "game-in-progress" | null) => void;
  roomId: string;
  displayName?: string | null;
  sendRoomEvent: (event: RoomMachineClientEvent) => void;
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
  spectatorNode,
  loading,
  authLoading,
  hasRejoinIntent,
  clearRejoinIntent,
  suppressAutoJoinIntent,
  cancelSeatRequestSafely,
  redirectGuard,
  lastKnownHostId,
  leavingRef,
  detachNow,
  setForcedExitReason,
  roomId,
  displayName,
  sendRoomEvent,
  recallOpen,
  skip = false,
}: UseForcedExitParams) {
  const forcedExitScheduledRef = useRef(false);
  const forcedExitCleanupRef = useRef(false);
  const forcedExitNotifiedRef = useRef(false);
  const forcedExitReasonRef = useRef<MachineSpectatorReason | null>(null);

  useEffect(() => {
    if (skip) {
      if (
        forcedExitScheduledRef.current ||
        forcedExitCleanupRef.current ||
        forcedExitNotifiedRef.current ||
        forcedExitReasonRef.current !== null
      ) {
        traceAction("spectator.forceExit.skip", {
          roomId,
          uid,
          skipReason: "skip-flag",
          spectatorNode,
        });
      }
      forcedExitScheduledRef.current = false;
      forcedExitCleanupRef.current = false;
      forcedExitNotifiedRef.current = false;
      forcedExitReasonRef.current = null;
      return;
    }
    if (!uid) return;
    if (leavingRef.current) return;
    if (lastKnownHostId === uid) return;
    // プレイヤー情報が揃うまで待つ
    if (loading || authLoading) return;
    if (redirectGuard) return;

    if (hasRejoinIntent()) return;

    const dispatchSpectatorForceExit = (reason: MachineSpectatorReason | null) => {
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
        logSpectatorForceExitDetected({
          roomId,
          uid,
          reason: forceExitReason,
          canAccess,
          recallOpen,
          status: roomStatus,
          spectatorNode,
        });
      }
      suppressAutoJoinIntent();
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
          void cancelSeatRequestSafely()
            .then((canceled) => {
              if (canceled) {
                clearRejoinIntent();
              }
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
          logSpectatorForceExitCleanup({
            roomId,
            uid,
            reason: forcedExitReasonRef.current ?? forceExitReason,
          });
          if (uid) {
            try {
              const canceled = await cancelSeatRequestSafely();
              if (canceled) {
                clearRejoinIntent();
              }
            } catch (error) {
              logDebug("useForcedExit", "auto-cancel-seat-request-failed", error);
            }
          }
          suppressAutoJoinIntent();
          const cleanupReason = forcedExitReasonRef.current ?? forceExitReason;
          dispatchSpectatorForceExit(cleanupReason);
          try {
            await detachNow();
          } catch (error) {
            logDebug("useForcedExit", "auto-detach-failed", error);
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
      logSpectatorForceExitRecovered({
        roomId,
        uid,
        status: roomStatus,
        canAccess,
        spectatorNode,
      });
      forcedExitScheduledRef.current = false;
      forcedExitNotifiedRef.current = false;
      // 注意: autoJoinSuppress は観戦者の明示操作でのみ解除する
      // 注意: forcedExitReason は page.tsx 側の自動再参加ロジックが参照するためここではクリアしない
    }
  }, [
    roomStatus,
    uid,
    canAccess,
    spectatorNode,
    loading,
    authLoading,
    hasRejoinIntent,
    clearRejoinIntent,
    suppressAutoJoinIntent,
    cancelSeatRequestSafely,
    redirectGuard,
    lastKnownHostId,
    leavingRef,
    setForcedExitReason,
    roomId,
    displayName,
    detachNow,
    sendRoomEvent,
    recallOpen,
    skip,
  ]);
}






