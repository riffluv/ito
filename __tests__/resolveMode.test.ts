import {
  canSubmitCard,
  computeAllSubmitted,
  isSortSubmit,
  normalizeResolveMode,
} from "@/lib/game/resolveMode";

describe("resolveMode utilities", () => {
  test("normalizeResolveMode default", () => {
    expect(normalizeResolveMode(undefined)).toBe("sequential");
    expect(normalizeResolveMode(null)).toBe("sequential");
    expect(normalizeResolveMode("foo")).toBe("sequential");
  });
  test("normalizeResolveMode keeps sort-submit", () => {
    expect(normalizeResolveMode("sort-submit")).toBe("sort-submit");
  });
  test("isSortSubmit predicate", () => {
    expect(isSortSubmit("sort-submit")).toBe(true);
    expect(isSortSubmit("sequential")).toBe(false);
  });
  test("computeAllSubmitted true case", () => {
    expect(
      computeAllSubmitted({
        mode: "sort-submit",
        eligibleIds: ["a", "b"],
        proposal: ["a", "b"],
      })
    ).toBe(true);
  });
  test("computeAllSubmitted false conditions", () => {
    expect(
      computeAllSubmitted({
        mode: "sequential",
        eligibleIds: ["a"],
        proposal: ["a"],
      })
    ).toBe(false);
    expect(
      computeAllSubmitted({
        mode: "sort-submit",
        eligibleIds: ["a", "b"],
        proposal: ["a"],
      })
    ).toBe(false);
  });
  test("canSubmitCard sequential requires cluesReady", () => {
    expect(
      canSubmitCard({
        mode: "sequential",
        canDecide: true,
        ready: true,
        placed: false,
        cluesReady: false,
      })
    ).toBe(false);
    expect(
      canSubmitCard({
        mode: "sequential",
        canDecide: true,
        ready: true,
        placed: false,
        cluesReady: true,
      })
    ).toBe(true);
  });
  test("canSubmitCard sort-submit ignores cluesReady", () => {
    expect(
      canSubmitCard({
        mode: "sort-submit",
        canDecide: true,
        ready: true,
        placed: false,
        cluesReady: false,
      })
    ).toBe(true);
  });
});
