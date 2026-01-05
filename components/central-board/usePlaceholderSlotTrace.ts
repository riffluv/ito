import { useEffect, useRef } from "react";
import { traceAction } from "@/lib/utils/trace";

export type PlaceholderSlot = { slot: number; cardId: string };

export function usePlaceholderSlotTrace(params: {
  placeholderSlots: PlaceholderSlot[];
  roomId: string;
}) {
  const placeholderLogRef = useRef<string | null>(null);

  useEffect(() => {
    if (!params.placeholderSlots.length) {
      placeholderLogRef.current = null;
      return;
    }
    const serialized = JSON.stringify(params.placeholderSlots);
    if (placeholderLogRef.current === serialized) {
      return;
    }
    placeholderLogRef.current = serialized;
    params.placeholderSlots.forEach(({ slot, cardId }) => {
      traceAction("board.slot.state", {
        roomId: params.roomId,
        slot,
        occupiedBy: cardId,
        reason: "missing-player-profile",
      });
    });
  }, [params.placeholderSlots, params.roomId]);
}

