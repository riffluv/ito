import { useMemo } from "react";

import { buildPlaceholderSlots } from "./boardDerivations";
import { usePlaceholderSlotTrace, type PlaceholderSlot } from "./usePlaceholderSlotTrace";

export function useBoardPlaceholderSlots(params: {
  boardProposal: (string | null)[];
  missingPlayerIds: string[];
  roomId: string;
}): PlaceholderSlot[] {
  const { boardProposal, missingPlayerIds, roomId } = params;

  const placeholderSlots = useMemo(() => {
    return buildPlaceholderSlots({ boardProposal, missingPlayerIds });
  }, [boardProposal, missingPlayerIds]);

  usePlaceholderSlotTrace({ placeholderSlots, roomId });

  return placeholderSlots;
}

