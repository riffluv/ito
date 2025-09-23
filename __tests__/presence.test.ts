import { isPresenceConnectionActive } from "@/lib/firebase/presence";

describe("isPresenceConnectionActive", () => {
  const now = 100_000;

  test("returns false when connection is explicitly offline", () => {
    expect(isPresenceConnectionActive({ online: false, ts: now }, now)).toBe(false);
  });

  test("returns true when connection is marked online without timestamp", () => {
    expect(isPresenceConnectionActive({ online: true }, now)).toBe(true);
  });

  test("returns true when timestamp is within active window", () => {
    expect(isPresenceConnectionActive({ ts: now - 1_000 }, now)).toBe(true);
  });

  test("returns false when timestamp is missing", () => {
    expect(isPresenceConnectionActive({}, now)).toBe(false);
  });

  test("returns false when timestamp is ahead of tolerated skew", () => {
    expect(isPresenceConnectionActive({ ts: now + 100_000 }, now)).toBe(false);
  });
});
