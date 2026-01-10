import {
  buildResetPlayerStateUpdate,
  resolveTargetPlayerId,
  shouldRequireHostForReset,
} from "@/lib/server/roomCommandsResetPlayerState/helpers";

describe("roomCommandsResetPlayerState helpers", () => {
  test("resolveTargetPlayerId uses trimmed playerId or falls back to uid", () => {
    expect(resolveTargetPlayerId({ uid: "u1", playerId: null })).toBe("u1");
    expect(resolveTargetPlayerId({ uid: "u1", playerId: "" })).toBe("u1");
    expect(resolveTargetPlayerId({ uid: "u1", playerId: " p " })).toBe("p");
  });

  test("shouldRequireHostForReset returns true when target differs", () => {
    expect(shouldRequireHostForReset({ uid: "u1", targetId: "u1" })).toBe(false);
    expect(shouldRequireHostForReset({ uid: "u1", targetId: "u2" })).toBe(true);
  });

  test("buildResetPlayerStateUpdate returns baseline fields", () => {
    const ts = Symbol("ts");
    expect(buildResetPlayerStateUpdate({ lastSeen: ts })).toEqual({
      number: null,
      clue1: "",
      ready: false,
      orderIndex: 0,
      lastSeen: ts,
    });
  });
});

