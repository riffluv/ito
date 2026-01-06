import { useMemo } from "react";
import type { ResolveMode } from "@/lib/game/resolveMode";
import { useRevealAnimation } from "@/components/hooks/useRevealAnimation";
import { useResultOverlayAllowed } from "./useResultOverlayAllowed";
import type { RoomDoc } from "@/lib/types";

export function useBoardRevealState(params: {
  roomId: string;
  roomStatus: RoomDoc["status"];
  resolveMode?: ResolveMode | null;
  orderListLength: number;
  orderList?: string[] | null;
  orderNumbers?: Record<string, number | null | undefined> | null;
  startPending: boolean;
}): {
  revealAnimating: boolean;
  revealIndex: number;
  realtimeResult: { success: boolean; failedAt: number | null; currentIndex: number } | null;
  finalizeScheduled: boolean;
  resultIntroReadyAt: number | null;
  resultOverlayAllowed: boolean;
} {
  const {
    roomId,
    roomStatus,
    resolveMode,
    orderListLength,
    orderList,
    orderNumbers,
    startPending,
  } = params;

  const orderData = useMemo(() => {
    if (
      !Array.isArray(orderList) ||
      orderList.length === 0 ||
      !orderNumbers ||
      typeof orderNumbers !== "object"
    ) {
      return null;
    }
    return {
      list: orderList,
      numbers: orderNumbers,
    };
  }, [orderList, orderNumbers]);

  const {
    revealAnimating,
    revealIndex,
    realtimeResult,
    finalizeScheduled,
    resultIntroReadyAt,
  } = useRevealAnimation({
    roomId,
    roomStatus,
    resolveMode: resolveMode ?? undefined,
    orderListLength,
    orderData,
    startPending,
  });

  const resultOverlayAllowed = useResultOverlayAllowed({
    roomStatus,
    resultIntroReadyAt,
  });

  return {
    revealAnimating,
    revealIndex,
    realtimeResult,
    finalizeScheduled,
    resultIntroReadyAt,
    resultOverlayAllowed,
  };
}
