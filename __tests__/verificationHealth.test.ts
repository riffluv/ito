import {
  DEFAULT_HEALTH,
  HEALTH_DECAY_MS,
  MAX_BACKOFF_MS,
  MIN_BACKOFF_MS,
  getVerificationHealth,
  shouldSkipVerification,
  updateHealthOnFailure,
  updateHealthOnSuccess,
  type VerificationHealth,
} from "@/lib/lobby/verificationHealth";

describe("verification health", () => {
  const baseNow = 1_000_000;

  const build = (overrides: Partial<VerificationHealth> = {}): VerificationHealth => ({
    backoffMs: MIN_BACKOFF_MS,
    failures: 0,
    lastVerifiedAt: 0,
    healthScore: DEFAULT_HEALTH,
    ...overrides,
  });

  test("initializes with defaults when missing", () => {
    const store = new Map<string, VerificationHealth>();
    const entry = getVerificationHealth(store, "room-a", baseNow);

    expect(entry).toEqual(
      expect.objectContaining({
        backoffMs: MIN_BACKOFF_MS,
        failures: 0,
        healthScore: DEFAULT_HEALTH,
      })
    );
    expect(store.get("room-a")).toBe(entry);
  });

  test("decays and recovers after inactivity", () => {
    const store = new Map<string, VerificationHealth>([
      [
        "room-a",
        build({
          backoffMs: 80_000,
          failures: 2,
          lastVerifiedAt: baseNow - HEALTH_DECAY_MS - 1_000,
          healthScore: 0.25,
        }),
      ],
    ]);

    const entry = getVerificationHealth(store, "room-a", baseNow);

    expect(entry.healthScore).toBeCloseTo(0.5); // +0.25 recovery step
    expect(entry.failures).toBe(1);
    expect(entry.backoffMs).toBe(40_000);
    expect(entry.lastVerifiedAt).toBe(baseNow);
  });

  test("punishes failure and caps backoff", () => {
    const entry = build({ backoffMs: 200_000 });

    updateHealthOnFailure(entry, baseNow + 1);

    expect(entry.failures).toBe(1);
    expect(entry.healthScore).toBe(DEFAULT_HEALTH - 0.5);
    expect(entry.backoffMs).toBe(MAX_BACKOFF_MS);
    expect(entry.lastVerifiedAt).toBe(baseNow + 1);
  });

  test("success heals and halves backoff but not below minimum", () => {
    const entry = build({
      backoffMs: 20_000,
      failures: 3,
      healthScore: 0.5,
    });

    updateHealthOnSuccess(entry, baseNow + 2);

    expect(entry.healthScore).toBeCloseTo(0.75);
    expect(entry.failures).toBe(0);
    expect(entry.backoffMs).toBe(10_000); // halved to min
    expect(entry.lastVerifiedAt).toBe(baseNow + 2);
  });

  test("skip depends on backoff and zero health", () => {
    const healthy = build({ backoffMs: 5_000 });
    const unhealthy = build({ healthScore: 0 });

    expect(shouldSkipVerification(healthy, baseNow - 1_000, baseNow)).toBe(true);
    expect(shouldSkipVerification(healthy, baseNow - 5_000, baseNow)).toBe(false);
    expect(shouldSkipVerification(unhealthy, baseNow - 10_000, baseNow)).toBe(true);
  });
});
