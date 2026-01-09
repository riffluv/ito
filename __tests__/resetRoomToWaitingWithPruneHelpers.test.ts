import {
  buildResetKeepIds,
  computePruneTargets,
  parseResetPruneFlag,
} from "@/lib/host/resetRoomToWaitingWithPrune/helpers";

describe("resetRoomToWaitingWithPrune helpers", () => {
  test("buildResetKeepIds keeps roundIds then onlineUids (deduped)", () => {
    const result = buildResetKeepIds({
      roundIds: ["a", "b", " ", "a"],
      onlineUids: ["b", "c", null, "   ", "d"] as any,
      includeOnline: true,
    });
    expect(result.keep).toEqual(["a", "b", "c", "d"]);
    expect(result.keepSet.has("a")).toBe(true);
    expect(result.keepSet.has("d")).toBe(true);
  });

  test("buildResetKeepIds ignores onlineUids when includeOnline is false", () => {
    const result = buildResetKeepIds({
      roundIds: ["a"],
      onlineUids: ["b"] as any,
      includeOnline: false,
    });
    expect(result.keep).toEqual(["a"]);
  });

  test("parseResetPruneFlag defaults true and disables on 0/false", () => {
    expect(parseResetPruneFlag(undefined)).toBe(true);
    expect(parseResetPruneFlag("")).toBe(true);
    expect(parseResetPruneFlag("0")).toBe(false);
    expect(parseResetPruneFlag("false")).toBe(false);
    expect(parseResetPruneFlag("FALSE")).toBe(false);
    expect(parseResetPruneFlag("1")).toBe(true);
  });

  test("computePruneTargets returns ids not in keepSet", () => {
    const keepSet = new Set(["a", "c"]);
    expect(computePruneTargets({ roundIds: ["a", "b", "c"], keepSet })).toEqual([
      "b",
    ]);
    expect(computePruneTargets({ roundIds: null, keepSet })).toEqual([]);
  });
});

