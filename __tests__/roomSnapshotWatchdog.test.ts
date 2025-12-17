import {
  evaluateRoomSnapshotWatchdog,
  type RoomSnapshotWatchdogEpisode,
} from "@/lib/hooks/roomSnapshotWatchdog";

const baseEpisode: RoomSnapshotWatchdogEpisode = {
  active: false,
  kind: null,
  startedAt: 0,
  lastAttemptAt: 0,
  attempts: 0,
  lastTraceAt: 0,
  hardCooldownUntil: 0,
};

const thresholds = {
  initialStaleMs: 20_000,
  postStaleMs: 5 * 60_000,
  cacheOnlyStaleMs: 12_000,
  recoveryCooldownMs: 4000,
  recoverySlowCooldownMs: 30_000,
  recoveryMaxAttempts: 6,
  recoveryHardCooldownMs: 60_000,
  traceIntervalMs: 20_000,
} as const;

describe("evaluateRoomSnapshotWatchdog", () => {
  test("keeps initial health before first server snapshot", () => {
    const decision = evaluateRoomSnapshotWatchdog(
      {
        now: 10_000,
        trigger: "interval",
        joinStatus: "joined",
        roomAccessBlocked: false,
        visible: true,
        online: true,
        lastServerSnapshotAt: null,
        lastSnapshotWasFromCache: false,
        cacheOnlySince: null,
        syncStartAt: 0,
        episode: baseEpisode,
      },
      thresholds
    );

    expect(decision.nextHealth).toBe("initial");
    expect(decision.shouldForceRefresh).toBe(false);
    expect(decision.nextRecoveryAttempts).toBe(0);
  });

  test("attempts recovery when initial snapshot is stuck", () => {
    const decision = evaluateRoomSnapshotWatchdog(
      {
        now: 30_000,
        trigger: "interval",
        joinStatus: "joined",
        roomAccessBlocked: false,
        visible: true,
        online: true,
        lastServerSnapshotAt: null,
        lastSnapshotWasFromCache: false,
        cacheOnlySince: null,
        syncStartAt: 0,
        episode: baseEpisode,
      },
      thresholds
    );

    expect(decision.nextHealth).toBe("recovering");
    expect(decision.staleKind).toBe("initial");
    expect(decision.shouldForceRefresh).toBe(true);
    expect(decision.shouldRestartListener).toBe(false);
    expect(decision.nextRecoveryAttempts).toBe(1);
  });

  test("respects recovery cooldown to avoid infinite retries", () => {
    const decision = evaluateRoomSnapshotWatchdog(
      {
        now: 32_000,
        trigger: "interval",
        joinStatus: "joined",
        roomAccessBlocked: false,
        visible: true,
        online: true,
        lastServerSnapshotAt: null,
        lastSnapshotWasFromCache: false,
        cacheOnlySince: null,
        syncStartAt: 0,
        episode: {
          ...baseEpisode,
          active: true,
          kind: "initial",
          attempts: 1,
          lastAttemptAt: 30_000,
          lastTraceAt: 30_000,
        },
      },
      thresholds
    );

    expect(decision.nextHealth).toBe("stale");
    expect(decision.shouldForceRefresh).toBe(false);
    expect(decision.nextRecoveryAttempts).toBe(1);
  });

  test("restarts listener from the second recovery attempt", () => {
    const decision = evaluateRoomSnapshotWatchdog(
      {
        now: 40_500,
        trigger: "interval",
        joinStatus: "joined",
        roomAccessBlocked: false,
        visible: true,
        online: true,
        lastServerSnapshotAt: null,
        lastSnapshotWasFromCache: false,
        cacheOnlySince: null,
        syncStartAt: 0,
        episode: {
          ...baseEpisode,
          active: true,
          kind: "initial",
          attempts: 1,
          lastAttemptAt: 30_000,
          lastTraceAt: 30_000,
        },
      },
      thresholds
    );

    expect(decision.nextHealth).toBe("recovering");
    expect(decision.nextRecoveryAttempts).toBe(2);
    expect(decision.shouldRestartListener).toBe(true);
  });

  test("stops aggressive recovery after reaching max attempts", () => {
    const now = 100_000;
    const decision = evaluateRoomSnapshotWatchdog(
      {
        now,
        trigger: "interval",
        joinStatus: "joined",
        roomAccessBlocked: false,
        visible: true,
        online: true,
        lastServerSnapshotAt: null,
        lastSnapshotWasFromCache: false,
        cacheOnlySince: null,
        syncStartAt: 0,
        episode: {
          ...baseEpisode,
          active: true,
          kind: "initial",
          attempts: thresholds.recoveryMaxAttempts,
          lastAttemptAt: 60_000,
          lastTraceAt: 60_000,
        },
      },
      thresholds
    );

    expect(decision.nextHealth).toBe("stale");
    expect(decision.exhausted).toBe(true);
    expect(decision.shouldForceRefresh).toBe(false);
    expect(decision.nextEpisode.hardCooldownUntil).toBeGreaterThan(now);
  });

  test("keeps ok health after receiving server snapshots", () => {
    const decision = evaluateRoomSnapshotWatchdog(
      {
        now: 10_000,
        trigger: "interval",
        joinStatus: "joined",
        roomAccessBlocked: false,
        visible: true,
        online: true,
        lastServerSnapshotAt: 5000,
        lastSnapshotWasFromCache: false,
        cacheOnlySince: null,
        syncStartAt: 0,
        episode: baseEpisode,
      },
      thresholds
    );

    expect(decision.nextHealth).toBe("ok");
    expect(decision.shouldForceRefresh).toBe(false);
  });

  test("treats cache-only snapshots as stale and recovers", () => {
    const decision = evaluateRoomSnapshotWatchdog(
      {
        now: 100_000,
        trigger: "interval",
        joinStatus: "joined",
        roomAccessBlocked: false,
        visible: true,
        online: true,
        lastServerSnapshotAt: 10_000,
        lastSnapshotWasFromCache: true,
        cacheOnlySince: 80_000,
        syncStartAt: 0,
        episode: baseEpisode,
      },
      thresholds
    );

    expect(decision.staleKind).toBe("cache-only");
    expect(decision.nextHealth).toBe("recovering");
    expect(decision.shouldForceRefresh).toBe(true);
  });

  test("does not attempt recovery when offline", () => {
    const decision = evaluateRoomSnapshotWatchdog(
      {
        now: 500_000,
        trigger: "interval",
        joinStatus: "joined",
        roomAccessBlocked: false,
        visible: true,
        online: false,
        lastServerSnapshotAt: 0,
        lastSnapshotWasFromCache: false,
        cacheOnlySince: null,
        syncStartAt: 0,
        episode: baseEpisode,
      },
      thresholds
    );

    expect(decision.nextHealth).toBe("stale");
    expect(decision.shouldForceRefresh).toBe(false);
  });
});
