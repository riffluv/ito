import { useMemo } from "react";
import type { RoomDoc } from "@/lib/types";

type RealtimeResult = {
  failedAt: number | null;
} | null;

export function useBoardA11yMessage(params: {
  isRevealing: boolean;
  revealIndex: number;
  orderListLength: number;
  roomStatus: RoomDoc["status"];
  realtimeResult: RealtimeResult;
}): string {
  const { isRevealing, revealIndex, orderListLength, roomStatus, realtimeResult } =
    params;

  return useMemo(() => {
    if (isRevealing) {
      return `進行状況: ${revealIndex} / ${orderListLength}`;
    }
    if (roomStatus !== "finished") {
      return "";
    }
    const failedAt = realtimeResult?.failedAt;
    if (failedAt !== null && failedAt !== undefined) {
      return `結果: ${failedAt}番目で失敗`;
    }
    return "結果: 成功";
  }, [isRevealing, orderListLength, realtimeResult, revealIndex, roomStatus]);
}

