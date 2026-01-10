import { buildRevealPendingUpdates } from "@/lib/server/roomCommandsRevealPending/helpers";

describe("roomCommandsRevealPending helpers", () => {
  test("buildRevealPendingUpdates sets revealBeginAt based on pending", () => {
    const ts1 = Symbol("ts1");
    const ts2 = Symbol("ts2");
    const del = Symbol("del");
    expect(
      buildRevealPendingUpdates({
        pending: true,
        activeAt: ts1,
        beginAt: ts2,
        fieldDelete: del,
      })
    ).toEqual({
      "ui.revealPending": true,
      lastActiveAt: ts1,
      "ui.revealBeginAt": ts2,
    });
    expect(
      buildRevealPendingUpdates({
        pending: false,
        activeAt: ts1,
        beginAt: ts2,
        fieldDelete: del,
      })
    ).toEqual({
      "ui.revealPending": false,
      lastActiveAt: ts1,
      "ui.revealBeginAt": del,
    });
  });
});

