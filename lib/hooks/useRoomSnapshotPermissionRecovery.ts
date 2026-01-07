"use client";

import { ensureAuthSession } from "@/lib/firebase/authSession";
import { notifyPermissionRecovery } from "@/lib/firebase/permissionGuard";
import { useEffect, useRef } from "react";

export function useRoomSnapshotPermissionRecovery(params: {
  roomAccessError: string | null;
}) {
  const { roomAccessError } = params;
  const prevRoomAccessErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (roomAccessError === "permission-denied") {
      if (prevRoomAccessErrorRef.current !== "permission-denied") {
        notifyPermissionRecovery("start", "ルームとの同期");
      }
      ensureAuthSession("room-access-denied").catch(() => void 0);
    } else if (
      prevRoomAccessErrorRef.current === "permission-denied" &&
      roomAccessError === null
    ) {
      notifyPermissionRecovery("success", "ルームとの同期");
    }
    prevRoomAccessErrorRef.current = roomAccessError;
  }, [roomAccessError]);
}

