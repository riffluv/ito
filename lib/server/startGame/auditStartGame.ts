import { logRoomCommandAudit } from "@/lib/server/roomAudit";
import { traceAction } from "@/lib/utils/trace";
import type { RoomDoc } from "@/lib/types";

export async function auditStartGame(params: {
  roomId: string;
  uid: string;
  requestId: string;
  prevStatus: RoomDoc["status"] | null;
  allowFromFinished: boolean;
  allowFromClue: boolean;
  doAutoDeal: boolean;
  alreadyStarted: boolean;
}): Promise<void> {
  if (params.alreadyStarted) {
    traceAction("host.start.server.idempotent", {
      roomId: params.roomId,
      uid: params.uid,
      requestId: params.requestId,
    });
    void logRoomCommandAudit({
      roomId: params.roomId,
      uid: params.uid,
      requestId: params.requestId,
      command: "start",
      prevStatus: params.prevStatus,
      nextStatus: "clue",
      note: "idempotent",
    });
    return;
  }

  traceAction("host.start.server", {
    roomId: params.roomId,
    uid: params.uid,
    requestId: params.requestId,
    allowFromFinished: params.allowFromFinished,
    allowFromClue: params.allowFromClue,
    prevStatus: params.prevStatus,
    nextStatus: "clue",
    autoDeal: params.doAutoDeal ? "1" : "0",
  });
  void logRoomCommandAudit({
    roomId: params.roomId,
    uid: params.uid,
    requestId: params.requestId,
    command: "start",
    prevStatus: params.prevStatus,
    nextStatus: "clue",
    note: params.doAutoDeal ? "autoDeal" : undefined,
  });
}

