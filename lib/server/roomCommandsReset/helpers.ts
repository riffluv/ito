import type { RoomSyncPatchRoom } from "@/lib/sync/roomSyncPatch";

export function buildWaitingRoomSyncForReset(params: {
  recallOpen: boolean;
}): RoomSyncPatchRoom {
  return {
    status: "waiting",
    topic: null,
    topicBox: null,
    round: 0,
    ui: {
      roundPreparing: false,
      recallOpen: params.recallOpen,
      revealPending: false,
    },
  };
}

