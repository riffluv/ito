"use client";

import type { useTransition } from "@/components/ui/TransitionProvider";
import { leaveRoom as leaveRoomAction } from "@/lib/firebase/rooms";
import { useLeaveCleanup } from "@/lib/hooks/useLeaveCleanup";
import type {
  RoomMachineClientEvent,
  SpectatorReason as MachineSpectatorReason,
} from "@/lib/state/roomMachine";
import { logError } from "@/lib/utils/log";
import { bumpMetric } from "@/lib/utils/metrics";
import type { User } from "firebase/auth";
import { useCallback, useEffect, useRef, type MutableRefObject } from "react";

type TransitionValue = ReturnType<typeof useTransition>;

type RouterLike = {
  push: (href: string) => void;
  replace: (href: string) => void;
};

export function useRoomLeaveFlow({
  roomId,
  uid,
  displayName,
  router,
  transition,
  user,
  detachNow,
  leavingRef,
  versionMismatchBlocksAccess,
  forcedExitReason,
  setForcedExitReason,
  roomStatus,
  recallOpen,
  sendRoomEvent,
}: {
  roomId: string;
  uid: string | null;
  displayName: string | null | undefined;
  router: RouterLike;
  transition: TransitionValue | null;
  user: User | null;
  detachNow: () => Promise<void> | void;
  leavingRef: MutableRefObject<boolean>;
  versionMismatchBlocksAccess: boolean;
  forcedExitReason: "game-in-progress" | "version-mismatch" | null;
  setForcedExitReason: (reason: "game-in-progress" | "version-mismatch" | null) => void;
  roomStatus: string | null;
  recallOpen: boolean;
  sendRoomEvent: (event: RoomMachineClientEvent) => void;
}) {
  const versionMismatchHandledRef = useRef(false);

  useEffect(() => {
    if (!versionMismatchBlocksAccess) {
      versionMismatchHandledRef.current = false;
      if (forcedExitReason === "version-mismatch") {
        setForcedExitReason(null);
        if (leavingRef.current) {
          leavingRef.current = false;
        }
      }
      return;
    }
    if (!uid) return;
    if (versionMismatchHandledRef.current) return;
    versionMismatchHandledRef.current = true;
    bumpMetric("forcedExit", "versionMismatch");
    bumpMetric("forcedExit", "versionMismatch");
    leavingRef.current = true;

    void (async () => {
      try {
        await detachNow();
      } catch (error) {
        logError("room-page", "version-mismatch-detach-now", error);
      }

      try {
        await leaveRoomAction(roomId, uid, displayName);
      } catch (error) {
        logError("room-page", "version-mismatch-leave-room-action", error);
      }
    })();
  }, [
    versionMismatchBlocksAccess,
    uid,
    detachNow,
    roomId,
    displayName,
    setForcedExitReason,
    forcedExitReason,
    leavingRef,
  ]);

  const executeForcedExit = useCallback(async () => {
    if (!uid) return;

    if (!leavingRef.current) {
      leavingRef.current = true;
    }

    const performExit = async () => {
      const forceExitReason: MachineSpectatorReason =
        roomStatus === "waiting"
          ? recallOpen
            ? "waiting-open"
            : "waiting-closed"
          : "mid-game";

      sendRoomEvent({ type: "SPECTATOR_FORCE_EXIT", reason: forceExitReason });

      try {
        await detachNow();
      } catch (error) {
        logError("room-page", "forced-exit-detach-now", error);
      }

      try {
        await leaveRoomAction(roomId, uid, displayName);
      } catch (error) {
        logError("room-page", "forced-exit-leave-room-action", error);
      }
    };

    try {
      if (transition) {
        await transition.navigateWithTransition(
          "/",
          {
            direction: "fade",
            duration: 1.0,
            showLoading: true,
            loadingSteps: [
              { id: "disconnect", message: "せつだん中です...", duration: 730 },
              { id: "exit", message: "ロビーへ もどります...", duration: 880 },
              { id: "done", message: "かんりょう！", duration: 390 },
            ],
          },
          performExit
        );
      } else {
        await performExit();
        router.replace("/");
      }
    } catch (error) {
      logError("room-page", "forced-exit-router-replace", error);
    } finally {
      setForcedExitReason(null);
    }
  }, [
    uid,
    leavingRef,
    detachNow,
    roomId,
    displayName,
    router,
    transition,
    sendRoomEvent,
    recallOpen,
    roomStatus,
    setForcedExitReason,
  ]);

  const handleForcedExitLeaveNow = useCallback(() => {
    void executeForcedExit();
  }, [executeForcedExit]);

  const leaveRoom = useCallback(async () => {
    if (!uid) return;
    leavingRef.current = true;
    const performLeave = async () => {
      try {
        await Promise.all([
          Promise.resolve(detachNow()).catch((error: unknown) => {
            logError("room-page", "leave-detach-now", error);
          }),
          Promise.resolve(leaveRoomAction(roomId, uid, displayName)).catch(
            (error: unknown) => {
              logError("room-page", "leave-room-action", error);
            }
          ),
        ]);
      } catch (error) {
        logError("room-page", "leave-parallel-cleanup", error);
      }
    };

    try {
      if (transition) {
        await transition.navigateWithTransition(
          "/",
          {
            direction: "fade",
            duration: 1.0,
            showLoading: true,
            loadingSteps: [
              { id: "disconnect", message: "せつだん中です...", duration: 730 },
              { id: "leave", message: "ロビーへ もどります...", duration: 880 },
              { id: "done", message: "かんりょう！", duration: 390 },
            ],
          },
          async () => {
            await performLeave();
          }
        );
      } else {
        await performLeave();
        router.push("/");
      }
    } catch (error) {
      logError("room-page", "leave-room", error);
      if (transition) {
        await transition.navigateWithTransition("/", {
          direction: "fade",
          duration: 0.8,
          showLoading: true,
          loadingSteps: [
            { id: "error", message: "エラーが発生しました...", duration: 800 },
            { id: "return", message: "ロビーに戻ります...", duration: 800 },
            { id: "complete", message: "完了しました!", duration: 400 },
          ],
        });
      } else {
        router.push("/");
      }
    }
  }, [uid, leavingRef, roomId, detachNow, displayName, transition, router]);

  useLeaveCleanup({
    enabled: true,
    roomId,
    uid,
    displayName,
    detachNow,
    leavingRef,
    user,
  });

  return {
    leaveRoom,
    handleForcedExitLeaveNow,
  };
}
