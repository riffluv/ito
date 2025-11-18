import {
  buildDeterministicNumberMap,
  validateSubmitList,
} from "@/lib/game/domain";

describe("validateSubmitList", () => {
  const players = ["p1", "p2", "p3"];

  test("rejects duplicates", () => {
    const result = validateSubmitList(["p1", "p1"], players, players.length);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch("重複");
    }
  });

  test("rejects length mismatch", () => {
    const result = validateSubmitList(["p1", "p2"], players, players.length);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch("一致しません");
    }
  });

  test("rejects member outside round", () => {
    const result = validateSubmitList(["p1", "p2", "x"], players, players.length);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch("対象外");
    }
  });

  test("passes valid list", () => {
    const result = validateSubmitList(players, players, players.length);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.expected).toBe(3);
    }
  });
});

describe("buildDeterministicNumberMap", () => {
  test("returns stable mapping for same seed", () => {
    const ids = ["a", "b", "c"];
    const seed = "seed-123";
    const first = buildDeterministicNumberMap(ids, seed, 1, 100);
    const second = buildDeterministicNumberMap(ids, seed, 1, 100);
    expect(first).toEqual(second);
  });
});
