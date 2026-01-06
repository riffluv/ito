import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { useBoardDebugDumpState } from "./useBoardDebugDumpState";

export function useBoardDebugDumpBundle(params: {
  enabled: boolean;
  roomId: string;
  activeProposal: (string | null)[];
  boardProposal: (string | null)[];
  optimisticProposal: (string | null)[] | null;
  pending: (string | null)[];
  placeholderSlots: { slot: number; cardId: string }[];
  waitingPlayers: (PlayerDoc & { id: string })[];
  eligibleIds: string[];
  missingPlayerIds: string[];
  roomStatus: RoomDoc["status"];
}): void {
  useBoardDebugDumpState(params);
}

