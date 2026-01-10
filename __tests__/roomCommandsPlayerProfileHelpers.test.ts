import {
  buildPlayerProfileUpdates,
  resolveTargetPlayerId,
  shouldRequireHostForProfileUpdate,
} from "@/lib/server/roomCommandsPlayerProfile/helpers";

describe("roomCommandsPlayerProfile helpers", () => {
  test("resolveTargetPlayerId uses trimmed playerId or falls back to uid", () => {
    expect(resolveTargetPlayerId({ uid: "u1", playerId: null })).toBe("u1");
    expect(resolveTargetPlayerId({ uid: "u1", playerId: "" })).toBe("u1");
    expect(resolveTargetPlayerId({ uid: "u1", playerId: " p " })).toBe("p");
  });

  test("shouldRequireHostForProfileUpdate matches target!=uid", () => {
    expect(shouldRequireHostForProfileUpdate({ uid: "u1", targetId: "u1" })).toBe(false);
    expect(shouldRequireHostForProfileUpdate({ uid: "u1", targetId: "u2" })).toBe(true);
  });

  test("buildPlayerProfileUpdates always sets lastSeen and conditionally sets name/avatar", () => {
    const ts = Symbol("ts");
    const sanitizeName = (value: string) => value.trim().toUpperCase();
    expect(buildPlayerProfileUpdates({ lastSeen: ts, name: "", avatar: "", sanitizeName })).toEqual({
      lastSeen: ts,
    });
    expect(buildPlayerProfileUpdates({ lastSeen: ts, name: "  a  ", avatar: "x", sanitizeName })).toEqual({
      lastSeen: ts,
      name: "A",
      avatar: "x",
    });
  });
});
