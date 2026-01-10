import { buildReadyUpdate } from "@/lib/server/roomCommandsReady/helpers";

describe("roomCommandsReady helpers", () => {
  test("buildReadyUpdate sets ready and lastSeen", () => {
    const ts = Symbol("ts");
    expect(buildReadyUpdate({ ready: true, lastSeen: ts })).toEqual({ ready: true, lastSeen: ts });
  });
});

