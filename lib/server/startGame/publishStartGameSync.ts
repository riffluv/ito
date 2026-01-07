import type { RoomDoc } from "@/lib/types";
import type { RoomSyncPatch } from "@/lib/sync/roomSyncPatch";
import { buildRoomSyncPatch, publishRoomSyncPatch } from "@/lib/server/roomSync";

export function publishStartGameSync(params: {
  roomId: string;
  statusVersion: number;
  requestId: string;
  ts: number;
  topic: string | null | undefined;
  topicBox: RoomDoc["topicBox"] | null | undefined;
}): RoomSyncPatch {
  const sync = buildRoomSyncPatch({
    roomId: params.roomId,
    statusVersion: params.statusVersion,
    room: {
      status: "clue",
      topic: params.topic,
      topicBox: params.topicBox,
      ui: { roundPreparing: false, recallOpen: false, revealPending: false },
    },
    command: "start",
    requestId: params.requestId,
    source: "api",
    ts: params.ts,
  });
  void publishRoomSyncPatch({
    ...sync,
    meta: { ...sync.meta, source: "rtdb" },
  });
  return sync;
}

