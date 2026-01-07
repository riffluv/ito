import { logRoomCommandAudit } from "@/lib/server/roomAudit";
import { safeTraceAction } from "@/lib/server/roomCommandShared";
import type { RoomDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";

export function auditNextRound(params: {
  roomId: string;
  uid: string;
  requestId: string;
  prevStatus: RoomDoc["status"] | null;
  playerCount: number;
  topicType: string | null;
  topic: string | null;
  round: number;
}): void {
  traceAction("room.nextRound.server", {
    roomId: params.roomId,
    uid: params.uid,
    requestId: params.requestId,
    prevStatus: params.prevStatus,
    nextStatus: "clue",
    playerCount: params.playerCount,
    topicType: params.topicType ?? null,
  });
  void logRoomCommandAudit({
    roomId: params.roomId,
    uid: params.uid,
    requestId: params.requestId,
    command: "next",
    prevStatus: params.prevStatus,
    nextStatus: "clue",
    note: `playerCount:${params.playerCount}`,
  });

  safeTraceAction("nextRound.server", {
    roomId: params.roomId,
    uid: params.uid,
    round: params.round,
    playerCount: params.playerCount,
    topicType: params.topicType,
    topic: params.topic ?? undefined,
  });
}

