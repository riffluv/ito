import type { ResolveMode } from "@/lib/game/resolveMode";
import type { RoomDoc } from "@/lib/types";

export function isBoardInteractive(params: {
  interactionEnabled: boolean;
  resolveMode?: ResolveMode | null;
  roomStatus: RoomDoc["status"];
}): boolean {
  const { interactionEnabled, resolveMode, roomStatus } = params;
  return interactionEnabled && resolveMode === "sort-submit" && roomStatus === "clue";
}

