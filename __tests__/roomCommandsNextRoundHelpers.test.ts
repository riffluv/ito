import {
  NEXT_ROUND_ALLOWED_STATUSES,
  buildNextFailureTrace,
  buildNextLockHolder,
  buildNextLockedTrace,
  isAllowedNextRoundStatus,
  isIdempotentNextRound,
  shouldRateLimit,
} from "@/lib/server/roomCommandsNextRound/helpers";

describe("roomCommandsNextRound helpers", () => {
  test("NEXT_ROUND_ALLOWED_STATUSES contains expected statuses", () => {
    expect(NEXT_ROUND_ALLOWED_STATUSES).toEqual(["reveal", "finished", "waiting", "clue"]);
  });

  test("isAllowedNextRoundStatus allows null/undefined and the allowed statuses", () => {
    expect(isAllowedNextRoundStatus(null)).toBe(true);
    expect(isAllowedNextRoundStatus(undefined)).toBe(true);
    expect(isAllowedNextRoundStatus("waiting" as any)).toBe(true);
    expect(isAllowedNextRoundStatus("clue" as any)).toBe(true);
    expect(isAllowedNextRoundStatus("unknown" as any)).toBe(false);
  });

  test("isIdempotentNextRound matches requestId + status clue", () => {
    expect(
      isIdempotentNextRound({ nextRequestId: "r1", requestId: "r1", status: "clue" as any })
    ).toBe(true);
    expect(
      isIdempotentNextRound({ nextRequestId: "r1", requestId: "r2", status: "clue" as any })
    ).toBe(false);
    expect(
      isIdempotentNextRound({ nextRequestId: "r1", requestId: "r1", status: "waiting" as any })
    ).toBe(false);
  });

  test("shouldRateLimit matches now-last < rateLimit", () => {
    expect(shouldRateLimit({ lastCommandMs: null, nowMs: 1000, rateLimitMs: 700 })).toBe(false);
    expect(shouldRateLimit({ lastCommandMs: 500, nowMs: 1000, rateLimitMs: 700 })).toBe(true);
    expect(shouldRateLimit({ lastCommandMs: 300, nowMs: 1000, rateLimitMs: 700 })).toBe(false);
  });

  test("buildNextLockHolder prefixes requestId", () => {
    expect(buildNextLockHolder("abc")).toBe("next:abc");
  });

  test("buildNextLockedTrace returns expected shape", () => {
    expect(buildNextLockedTrace({ roomId: "r", requestId: "q", holder: "next:q" })).toEqual({
      roomId: "r",
      requestId: "q",
      holder: "next:q",
    });
  });

  test("buildNextFailureTrace maps room fields and locked flag", () => {
    const trace = buildNextFailureTrace({
      roomId: "r",
      requestId: "q",
      prevStatus: "waiting" as any,
      failureRoom: { status: "clue", ui: { roundPreparing: true }, nextRequestId: "n1" } as any,
      locked: true,
    });
    expect(trace).toEqual({
      roomId: "r",
      requestId: "q",
      prevStatus: "waiting",
      status: "clue",
      roundPreparing: true,
      nextRequestId: "n1",
      locked: "1",
    });
  });
});

