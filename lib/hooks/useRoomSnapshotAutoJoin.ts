"use client";

import { notify } from "@/components/ui/notify";
import {
  getRoomServiceErrorCode,
  joinRoomFully,
} from "@/lib/services/roomService";
import type { RoomDoc } from "@/lib/types";
import { logDebug, logError } from "@/lib/utils/log";
import {
  BASE_JOIN_RETRY_DELAY_MS,
  JOIN_RETRY_BACKOFF_FACTOR,
  MAX_JOIN_RETRIES,
  MAX_JOIN_RETRY_DELAY_MS,
} from "@/lib/hooks/roomSnapshotConfig";
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

export type RoomJoinStatus = "idle" | "joining" | "retrying" | "joined";

export function useRoomSnapshotAutoJoin(params: {
  firebaseEnabled: boolean;
  uid: string | null;
  room: (RoomDoc & { id: string }) | null;
  leavingRef: MutableRefObject<boolean>;
  roomAccessBlocked: boolean;
  isMember: boolean;
  normalizedDisplayName: string | null;
  roomId: string;
  joinStatus: RoomJoinStatus;
  setJoinStatus: Dispatch<SetStateAction<RoomJoinStatus>>;
  joinCompletedRef: MutableRefObject<boolean>;
  joinInFlightRef: MutableRefObject<Promise<unknown> | null>;
  joinRetryTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  joinAttemptRef: MutableRefObject<number>;
  joinLimitNotifiedRef: MutableRefObject<boolean>;
  handleRoomServiceAccessError: (error: unknown, source: "join" | "ensureMember") => boolean;
}) {
  const {
    firebaseEnabled,
    uid,
    room,
    leavingRef,
    roomAccessBlocked,
    isMember,
    normalizedDisplayName,
    roomId,
    joinStatus,
    setJoinStatus,
    joinCompletedRef,
    joinInFlightRef,
    joinRetryTimerRef,
    joinAttemptRef,
    joinLimitNotifiedRef,
    handleRoomServiceAccessError,
  } = params;

  useEffect(() => {
    if (!firebaseEnabled) return;
    if (!uid || !room) return;
    if (leavingRef.current) return;
    if (roomAccessBlocked) return;
    if (!normalizedDisplayName) return;

    const recallClosedForJoin =
      room.status === "waiting" &&
      room.ui?.recallOpen === false &&
      !isMember &&
      room.hostId !== uid;

    const clearRetryTimer = () => {
      if (joinRetryTimerRef.current) {
        clearTimeout(joinRetryTimerRef.current);
        joinRetryTimerRef.current = null;
      }
    };

    if (recallClosedForJoin) {
      joinAttemptRef.current = 0;
      joinCompletedRef.current = false;
      joinLimitNotifiedRef.current = false;
      clearRetryTimer();
      if (joinStatus !== "idle") {
        setJoinStatus("idle");
      }
      return;
    }

    if (room.status === "waiting") {
      const alreadyJoined = joinCompletedRef.current;
      if (alreadyJoined) {
        clearRetryTimer();
        return;
      }
      if (joinInFlightRef.current) return;

      clearRetryTimer();
      const attemptBeforeCall = joinAttemptRef.current;
      const joinTask = joinRoomFully({
        roomId,
        uid,
        displayName: normalizedDisplayName,
        notifyChat: true,
      })
        .then(() => {
          joinCompletedRef.current = true;
          joinAttemptRef.current = 0;
          joinLimitNotifiedRef.current = false;
          clearRetryTimer();
          setJoinStatus("joined");
        })
        .catch((error) => {
          const code = getRoomServiceErrorCode(error);
          if (code === "ROOM_VERSION_MISMATCH" || code === "ROOM_VERSION_CHECK_FAILED") {
            handleRoomServiceAccessError(error, "join");
            joinCompletedRef.current = true;
            joinLimitNotifiedRef.current = true;
            clearRetryTimer();
            setJoinStatus("idle");
            return;
          }

          joinCompletedRef.current = false;
          const nextAttempt = attemptBeforeCall + 1;
          joinAttemptRef.current = nextAttempt;
          const cappedAttempt = Math.min(Math.max(nextAttempt, 1), MAX_JOIN_RETRIES);
          const delay = Math.min(
            BASE_JOIN_RETRY_DELAY_MS *
              Math.pow(JOIN_RETRY_BACKOFF_FACTOR, Math.max(cappedAttempt - 1, 0)),
            MAX_JOIN_RETRY_DELAY_MS
          );
          const reachedLimit = nextAttempt > MAX_JOIN_RETRIES;

          if (reachedLimit && !joinLimitNotifiedRef.current) {
            joinLimitNotifiedRef.current = true;
            notify({
              title: "接続を再試行しています",
              description:
                "参加処理が続けて失敗しています。ネットワークを確認しつつ、このまま再試行します。",
              type: "warning",
            });
          }

          logDebug("room-snapshot", "joinRoomFully-retry", {
            roomId,
            uid,
            delay,
            reachedLimit,
          });

          clearRetryTimer();
          joinRetryTimerRef.current = setTimeout(() => {
            joinRetryTimerRef.current = null;
            setJoinStatus("retrying");
          }, delay);

          if (reachedLimit) {
            logError("room-snapshot", "joinRoomFully-max-retries-keep-retrying", {
              error,
              roomId,
              uid,
              attempt: nextAttempt,
            });
          }
        })
        .finally(() => {
          joinInFlightRef.current = null;
        });

      joinInFlightRef.current = joinTask;
      setJoinStatus("joining");
      joinTask.catch(() => void 0);
    } else {
      joinAttemptRef.current = 0;
      if (joinRetryTimerRef.current) {
        clearTimeout(joinRetryTimerRef.current);
        joinRetryTimerRef.current = null;
      }
      const joined = Boolean(room && isMember);
      setJoinStatus(joined ? "joined" : "idle");
    }
  }, [
    firebaseEnabled,
    handleRoomServiceAccessError,
    isMember,
    joinAttemptRef,
    joinCompletedRef,
    joinInFlightRef,
    joinLimitNotifiedRef,
    joinRetryTimerRef,
    joinStatus,
    leavingRef,
    normalizedDisplayName,
    room,
    roomAccessBlocked,
    roomId,
    setJoinStatus,
    uid,
  ]);
}

