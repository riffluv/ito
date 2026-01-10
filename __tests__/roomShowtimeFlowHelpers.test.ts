import { resolveRevealedMs } from "@/lib/hooks/showtimeFlow/helpers";

describe("showtimeFlow helpers", () => {
  test("resolveRevealedMs returns null for falsy/invalid values", () => {
    expect(resolveRevealedMs(null)).toBeNull();
    expect(resolveRevealedMs(undefined)).toBeNull();
    expect(resolveRevealedMs(0)).toBeNull();
    expect(resolveRevealedMs("")).toBeNull();
    expect(resolveRevealedMs(Number.NaN)).toBeNull();
    expect(resolveRevealedMs(Infinity)).toBeNull();
  });

  test("resolveRevealedMs supports Date", () => {
    const date = new Date(1700000000000);
    expect(resolveRevealedMs(date)).toBe(date.getTime());
  });

  test("resolveRevealedMs supports number (finite)", () => {
    expect(resolveRevealedMs(123)).toBe(123);
  });

  test("resolveRevealedMs supports Timestamp-like toMillis()", () => {
    expect(resolveRevealedMs({ toMillis: () => 456 })).toBe(456);
  });

  test("resolveRevealedMs returns null when toMillis throws", () => {
    expect(
      resolveRevealedMs({
        toMillis: () => {
          throw new Error("boom");
        },
      })
    ).toBeNull();
  });
});

