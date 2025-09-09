import {
  canSubmitCard,
  computeAllSubmitted,
  isSortSubmit,
  normalizeResolveMode,
} from "@/lib/game/resolveMode";

describe("resolveMode utilities", () => {
  test("normalizeResolveMode always returns sort-submit", () => {
    expect(normalizeResolveMode(undefined)).toBe("sort-submit");
    expect(normalizeResolveMode(null)).toBe("sort-submit");
    expect(normalizeResolveMode("foo")).toBe("sort-submit");
    expect(normalizeResolveMode("sort-submit")).toBe("sort-submit");
  });

  test("isSortSubmit predicate", () => {
    expect(isSortSubmit("sort-submit")).toBe(true);
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

  test("computeAllSubmitted false case - missing cards", () => {
    expect(
      computeAllSubmitted({
        mode: "sort-submit",
        eligibleIds: ["a", "b"],
        proposal: ["a"],
      })
    ).toBe(false);
  });

  test("computeAllSubmitted false when padded with nulls (fixed-length)", () => {
    expect(
      computeAllSubmitted({
        mode: "sort-submit",
        eligibleIds: ["a", "b", "c"],
        proposal: ["a", null, null],
      })
    ).toBe(false);
  });

  test("computeAllSubmitted true when non-null count matches eligibleIds length despite padding", () => {
    expect(
      computeAllSubmitted({
        mode: "sort-submit",
        eligibleIds: ["a", "b", "c"],
        proposal: ["a", "b", "c"],
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
