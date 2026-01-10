import { buildRoomOptionsUpdates } from "@/lib/server/roomCommandsRoomOptions/helpers";

describe("roomCommandsRoomOptions helpers", () => {
  test("buildRoomOptionsUpdates includes lastActiveAt and sets only truthy option fields", () => {
    const ts = Symbol("ts");
    expect(
      buildRoomOptionsUpdates({
        resolveMode: null,
        defaultTopicType: undefined,
        serverNow: ts,
      })
    ).toEqual({ lastActiveAt: ts });

    expect(
      buildRoomOptionsUpdates({
        resolveMode: "sort-submit",
        defaultTopicType: "通常版",
        serverNow: ts,
      })
    ).toEqual({
      lastActiveAt: ts,
      "options.resolveMode": "sort-submit",
      "options.defaultTopicType": "通常版",
    });
  });
});

