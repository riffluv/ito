import {
  canBypassDealRateLimit,
  countEligibleUids,
  deriveIsFirstDeal,
  getExistingDealCount,
  maybeFallbackDealTarget,
  shouldReturnIdempotentDealCount,
  sortDealCandidates,
} from "@/lib/server/roomCommandsDeal/helpers";

describe("roomCommandsDeal helpers", () => {
  test("getExistingDealCount returns null when missing", () => {
    expect(getExistingDealCount(undefined as any)).toBeNull();
    expect(getExistingDealCount({ deal: null } as any)).toBeNull();
    expect(getExistingDealCount({ deal: { players: "nope" } } as any)).toBeNull();
  });

  test("getExistingDealCount returns players length", () => {
    expect(getExistingDealCount({ deal: { players: ["a", "b"] } } as any)).toBe(2);
  });

  test("shouldReturnIdempotentDealCount returns count only when request matches", () => {
    expect(
      shouldReturnIdempotentDealCount({
        dealRequestId: "r1",
        requestId: "r1",
        existingDealCount: 3,
      })
    ).toBe(3);
    expect(
      shouldReturnIdempotentDealCount({
        dealRequestId: "r1",
        requestId: "r2",
        existingDealCount: 3,
      })
    ).toBeNull();
  });

  test("deriveIsFirstDeal returns true for empty/non-object", () => {
    expect(deriveIsFirstDeal(undefined)).toBe(true);
    expect(deriveIsFirstDeal(null)).toBe(true);
    expect(deriveIsFirstDeal({})).toBe(true);
    expect(deriveIsFirstDeal({ a: 1 })).toBe(false);
  });

  test("canBypassDealRateLimit allows first deal from clue/waiting only", () => {
    expect(canBypassDealRateLimit({ isFirstDeal: true, status: "clue" as any })).toBe(true);
    expect(canBypassDealRateLimit({ isFirstDeal: true, status: "waiting" as any })).toBe(true);
    expect(canBypassDealRateLimit({ isFirstDeal: true, status: "reveal" as any })).toBe(false);
    expect(canBypassDealRateLimit({ isFirstDeal: false, status: "clue" as any })).toBe(false);
  });

  test("sortDealCandidates sorts by uid||id", () => {
    const sorted = sortDealCandidates([
      { id: "b", uid: "b" },
      { id: "a" },
      { id: "c", uid: "c" },
    ]);
    expect(sorted.map((c) => c.uid || c.id)).toEqual(["a", "b", "c"]);
  });

  test("countEligibleUids counts non-empty uid strings", () => {
    expect(
      countEligibleUids([{ id: "a" }, { id: "b", uid: "" }, { id: "c", uid: "u" }])
    ).toBe(1);
  });

  test("maybeFallbackDealTarget uses fallback when suspected mismatch and fallback is larger", () => {
    const candidates = [
      { id: "a", uid: "a" },
      { id: "b", uid: "b" },
    ];
    const out = maybeFallbackDealTarget({
      ordered: [{ id: "a", uid: "a" }],
      candidates,
      eligibleCount: 2,
    });
    expect(out).toEqual(candidates);
  });

  test("maybeFallbackDealTarget keeps ordered when not suspected mismatch", () => {
    const out = maybeFallbackDealTarget({
      ordered: [{ id: "a", uid: "a" }, { id: "b", uid: "b" }],
      candidates: [{ id: "b", uid: "b" }, { id: "a", uid: "a" }],
      eligibleCount: 2,
    });
    expect(out.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

