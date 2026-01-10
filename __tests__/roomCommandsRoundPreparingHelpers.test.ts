import { buildRoundPreparingUpdate } from "@/lib/server/roomCommandsRoundPreparing/helpers";

describe("roomCommandsRoundPreparing helpers", () => {
  test("buildRoundPreparingUpdate sets ui.roundPreparing and lastActiveAt", () => {
    const ts = Symbol("ts");
    expect(buildRoundPreparingUpdate({ active: true, lastActiveAt: ts })).toEqual({
      "ui.roundPreparing": true,
      lastActiveAt: ts,
    });
  });
});

