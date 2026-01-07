import { buildRoomSyncPatch, publishRoomSyncPatch } from "@/lib/server/roomSync";
import type { RoomDoc } from "@/lib/types";
import type { RoomSyncPatch } from "@/lib/sync/roomSyncPatch";

export function publishNextRoundSync(params: {
  roomId: string;
  statusVersion: number;
  requestId: string;
  ts: number;
  topic: string | null;
  topicBox: RoomDoc["topicBox"] | null;
  round: number;
}): RoomSyncPatch {
  const sync = buildRoomSyncPatch({
    roomId: params.roomId,
    statusVersion: params.statusVersion,
    room: {
      status: "clue",
      topic: params.topic,
      topicBox: params.topicBox,
      round: params.round,
      ui: { roundPreparing: false, recallOpen: false, revealPending: false },
    },
    command: "next-round",
    requestId: params.requestId,
    source: "api",
    ts: params.ts,
  });
  void publishRoomSyncPatch({ ...sync, meta: { ...sync.meta, source: "rtdb" } });
  return sync;
}

