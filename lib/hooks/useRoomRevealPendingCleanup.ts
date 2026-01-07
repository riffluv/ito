"use client";

import { clearRevealPending } from "@/lib/game/service";
import { useEffect } from "react";

type UseRoomRevealPendingCleanupParams = {
  roomId: string;
  isHost: boolean;
  revealPending: boolean;
  roomStatus: string | null;
};

export function useRoomRevealPendingCleanup(params: UseRoomRevealPendingCleanupParams) {
  const { roomId, isHost, revealPending, roomStatus } = params;

  // reveal到達時のフラグクリーンアップ（冪等・ホストのみ実行）
  useEffect(() => {
    if (!isHost) return;
    if (!revealPending) return;
    if (roomStatus === "reveal" || roomStatus === "finished") {
      void clearRevealPending(roomId);
    }
  }, [isHost, revealPending, roomId, roomStatus]);
}

