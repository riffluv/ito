"use client";

import { ensureMember } from "@/lib/services/roomService";
import type { RoomDoc } from "@/lib/types";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { ENSURE_MEMBER_MIN_INTERVAL_MS } from "@/lib/hooks/roomSnapshotConfig";
import { useEffect, type MutableRefObject } from "react";

export type EnsureMemberHeartbeat = {
  roomId: string;
  uid: string;
  displayName: string | null | undefined;
  timestamp: number;
};

export function useRoomSnapshotEnsureMemberHeartbeat(params: {
  roomId: string;
  uid: string | null;
  displayName: string | null | undefined;
  room: (RoomDoc & { id: string }) | null;
  isMember: boolean;
  firebaseEnabled: boolean;
  roomAccessBlocked: boolean;
  leavingRef: MutableRefObject<boolean>;
  ensureMemberHeartbeatRef: MutableRefObject<EnsureMemberHeartbeat | null>;
  handleRoomServiceAccessError: (error: unknown, source: "join" | "ensureMember") => boolean;
}) {
  const {
    roomId,
    uid,
    displayName,
    room,
    isMember,
    firebaseEnabled,
    roomAccessBlocked,
    leavingRef,
    ensureMemberHeartbeatRef,
    handleRoomServiceAccessError,
  } = params;

  // ensureMember heartbeat (opportunistic, on snapshot changes)
  useEffect(() => {
    if (!room || !uid || !firebaseEnabled) return;
    if (roomAccessBlocked) return;
    const recallClosedForJoin =
      room.status === "waiting" &&
      room.ui?.recallOpen === false &&
      !isMember &&
      room.hostId !== uid;
    if (recallClosedForJoin) return;
    const now = Date.now();
    const last = ensureMemberHeartbeatRef.current;
    if (last && now - last.timestamp < ENSURE_MEMBER_MIN_INTERVAL_MS) return;
    ensureMemberHeartbeatRef.current = {
      roomId,
      uid,
      displayName,
      timestamp: now,
    };
    ensureMember({ roomId, uid, displayName, clientVersion: APP_VERSION }).catch((error) => {
      handleRoomServiceAccessError(error, "ensureMember");
    });
  }, [
    room,
    uid,
    firebaseEnabled,
    roomAccessBlocked,
    isMember,
    roomId,
    displayName,
    handleRoomServiceAccessError,
    ensureMemberHeartbeatRef,
  ]);

  // ensureMember heartbeat via background interval (best-effort)
  useEffect(() => {
    if (!firebaseEnabled || !uid || !room || leavingRef.current) {
      return undefined;
    }
    if (roomAccessBlocked) {
      return undefined;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const last = ensureMemberHeartbeatRef.current;
      if (last && now - last.timestamp < ENSURE_MEMBER_MIN_INTERVAL_MS) return;
      ensureMemberHeartbeatRef.current = {
        roomId,
        uid,
        displayName,
        timestamp: now,
      };
      ensureMember({ roomId, uid, displayName, clientVersion: APP_VERSION }).catch((error) => {
        handleRoomServiceAccessError(error, "ensureMember");
      });
    }, ENSURE_MEMBER_MIN_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [
    firebaseEnabled,
    uid,
    room,
    leavingRef,
    roomAccessBlocked,
    roomId,
    displayName,
    handleRoomServiceAccessError,
    ensureMemberHeartbeatRef,
  ]);
}
