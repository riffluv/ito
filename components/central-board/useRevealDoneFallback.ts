import { useEffect, useRef } from "react";

import type { ResolveMode } from "@/lib/game/resolveMode";
import { finalizeReveal } from "@/lib/game/room";
import type { RoomMachineClientEvent } from "@/lib/state/roomMachine";
import type { RoomDoc } from "@/lib/types";
import {
  FINAL_TWO_BONUS_DELAY,
  FLIP_DURATION_MS,
  FLIP_EVALUATION_DELAY,
  RESULT_INTRO_DELAY,
  RESULT_RECOGNITION_DELAY,
  REVEAL_FIRST_DELAY,
  REVEAL_INITIAL_STEP_DELAY,
  REVEAL_MIN_STEP_DELAY,
} from "@/lib/ui/motion";

export function useRevealDoneFallback({
  roomId,
  roomStatus,
  resolveMode,
  orderListLength,
  finalizeScheduled,
  sendRoomEvent,
  resultIntroReadyAt,
}: {
  roomId: string;
  roomStatus: RoomDoc["status"];
  resolveMode: ResolveMode | null | undefined;
  orderListLength: number;
  finalizeScheduled: boolean;
  sendRoomEvent?: (event: RoomMachineClientEvent) => void;
  resultIntroReadyAt?: number | null;
}) {
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearPendingTimer = () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };

    if (
      resolveMode === "sort-submit" &&
      roomStatus === "reveal" &&
      orderListLength > 0 &&
      !finalizeScheduled
    ) {
      const intervalCount = Math.max(orderListLength - 1, 0);
      const finalBonusSteps = Math.min(intervalCount, 2); // 最後の2枚だけ余韻を追加
      // 加速テンポの平均値で概算
      const avgStepDelay = Math.round(
        (REVEAL_INITIAL_STEP_DELAY + REVEAL_MIN_STEP_DELAY) / 2
      );
      const revealTraversal =
        REVEAL_FIRST_DELAY +
        intervalCount * avgStepDelay +
        finalBonusSteps * FINAL_TWO_BONUS_DELAY;

      // 最終カードのフリップ完了から一定時間（RESULT_INTRO_DELAY）待つ。評価待ちと余韻の長い方を採用。
      const lastFlipWindow = Math.max(
        FLIP_EVALUATION_DELAY,
        FLIP_DURATION_MS + RESULT_INTRO_DELAY + RESULT_RECOGNITION_DELAY
      );

      const SAFETY_BUFFER_MS = 600;
      const baseTotal = revealTraversal + lastFlipWindow + SAFETY_BUFFER_MS;
      const introAligned = resultIntroReadyAt
        ? resultIntroReadyAt +
          RESULT_RECOGNITION_DELAY +
          SAFETY_BUFFER_MS -
          Date.now()
        : 0;
      const total = Math.max(baseTotal, introAligned);

      clearPendingTimer();
      fallbackTimerRef.current = setTimeout(() => {
        // もしまだローカルがリビール中なら、最低でもローカルの resultIntroReadyAt が来るまで待つ
        if (sendRoomEvent) {
          try {
            sendRoomEvent({ type: "REVEAL_DONE" });
          } catch {
            finalizeReveal(roomId).catch(() => void 0);
          }
        } else {
          finalizeReveal(roomId).catch(() => void 0);
        }
      }, total);
      return clearPendingTimer;
    }

    clearPendingTimer();
    return clearPendingTimer;
  }, [
    finalizeScheduled,
    orderListLength,
    resolveMode,
    resultIntroReadyAt,
    roomId,
    roomStatus,
    sendRoomEvent,
  ]);
}
