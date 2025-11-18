import { deriveStableOnlineUids } from "@/lib/presence/stableOnline";

describe("deriveStableOnlineUids", () => {
  const graceMs = 5_000;
  const now = 10_000;

  test("keeps recently missing users within grace window", () => {
    const { stable, missingSince } = deriveStableOnlineUids({
      onlineUids: ["a", "b"],
      previousStable: ["a", "b", "c"],
      missingSince: {},
      now,
      graceMs,
    });

    expect(stable).toEqual(["a", "b", "c"]);
    expect(missingSince.c).toBe(now);
  });

  test("drops users after grace window elapses", () => {
    const { stable } = deriveStableOnlineUids({
      onlineUids: ["a"],
      previousStable: ["a", "c"],
      missingSince: { c: now - graceMs - 1 },
      now,
      graceMs,
    });

    expect(stable).toEqual(["a"]);
  });

  test("clears missing cache when user returns online", () => {
    const { stable, missingSince } = deriveStableOnlineUids({
      onlineUids: ["x", "y"],
      previousStable: ["x", "y"],
      missingSince: { y: now - 1_000 },
      now,
      graceMs,
    });

    expect(stable).toEqual(["x", "y"]);
    expect(missingSince.y).toBeUndefined();
  });

  test("keeps order and appends grace-kept users after current ones", () => {
    const { stable } = deriveStableOnlineUids({
      onlineUids: ["u2", "u3"],
      previousStable: ["u1", "u2", "u3"],
      missingSince: {},
      now,
      graceMs,
    });

    expect(stable).toEqual(["u2", "u3", "u1"]);
  });
});
