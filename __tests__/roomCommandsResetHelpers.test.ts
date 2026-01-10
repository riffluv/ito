import { buildWaitingRoomSyncForReset } from "@/lib/server/roomCommandsReset/helpers";

describe("roomCommandsReset helpers", () => {
  test("buildWaitingRoomSyncForReset builds waiting room patch with recallOpen", () => {
    expect(buildWaitingRoomSyncForReset({ recallOpen: true })).toEqual({
      status: "waiting",
      topic: null,
      topicBox: null,
      round: 0,
      ui: { roundPreparing: false, recallOpen: true, revealPending: false },
    });
    expect(buildWaitingRoomSyncForReset({ recallOpen: false })).toEqual({
      status: "waiting",
      topic: null,
      topicBox: null,
      round: 0,
      ui: { roundPreparing: false, recallOpen: false, revealPending: false },
    });
  });
});

