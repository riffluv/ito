import { derivePresenceCount } from "@/lib/hooks/lobbyCounts/derivePresenceCount";

describe("derivePresenceCount", () => {
  const now = 1_000_000;

  test("counts online uids within stale/clock skew and respects exclude set", () => {
    const res = derivePresenceCount({
      users: {
        a: { c1: { ts: now - 1_000 } },
        b: { c1: { ts: now - 40_000 } }, // stale
        c: { c1: { ts: now + 9_999 } }, // within skew => ok
        d: { c1: { ts: now + 10_001 } }, // beyond skew => ignore
      },
      excludeUidSet: new Set(["c"]),
      now,
      maxClockSkewMs: 10_000,
      staleMs: 35_000,
      acceptFreshMs: 5_000,
      debugUids: false,
      roomQuarantine: undefined,
    });
    expect(res.count).toBe(1); // only "a"
    expect(res.hasFresh).toBe(true); // "a" is within acceptFreshMs
    expect(res.includedUids).toBeUndefined();
    expect(res.presentUids).toBeUndefined();
  });

  test("treats online:true without ts as now and marks fresh", () => {
    const res = derivePresenceCount({
      users: { a: { c1: { online: true } } },
      excludeUidSet: new Set(),
      now,
      maxClockSkewMs: 10_000,
      staleMs: 35_000,
      acceptFreshMs: 5_000,
      debugUids: false,
      roomQuarantine: undefined,
    });
    expect(res.count).toBe(1);
    expect(res.hasFresh).toBe(true);
  });

  test("debugUids returns presentUids and includedUids", () => {
    const res = derivePresenceCount({
      users: {
        a: { c1: { ts: now - 1_000 } },
        b: { c1: { ts: now - 100_000 } }, // stale
      },
      excludeUidSet: new Set(),
      now,
      maxClockSkewMs: 10_000,
      staleMs: 35_000,
      acceptFreshMs: 5_000,
      debugUids: true,
      roomQuarantine: undefined,
    });
    expect(res.presentUids).toEqual(expect.arrayContaining(["a", "b"]));
    expect(res.includedUids).toEqual(["a"]);
  });

  test("quarantine blocks non-fresh online and clears on fresh join", () => {
    const res1 = derivePresenceCount({
      users: {
        a: { c1: { ts: now - 20_000 } }, // online but not fresh
      },
      excludeUidSet: new Set(),
      now,
      maxClockSkewMs: 10_000,
      staleMs: 35_000,
      acceptFreshMs: 5_000,
      debugUids: false,
      roomQuarantine: { a: now + 60_000 },
    });
    expect(res1.count).toBe(0);
    expect(res1.roomQuarantine).toEqual({ a: now + 60_000 });

    const res2 = derivePresenceCount({
      users: {
        a: { c1: { ts: now - 1_000 } }, // fresh
      },
      excludeUidSet: new Set(),
      now,
      maxClockSkewMs: 10_000,
      staleMs: 35_000,
      acceptFreshMs: 5_000,
      debugUids: false,
      roomQuarantine: res1.roomQuarantine,
    });
    expect(res2.count).toBe(1);
    expect(res2.roomQuarantine).toEqual({});
  });
});

