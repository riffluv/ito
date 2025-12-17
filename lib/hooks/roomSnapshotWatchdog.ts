export type RoomSnapshotWatchdogTrigger =
  | "init"
  | "interval"
  | "visibility"
  | "focus"
  | "online";

export type RoomSnapshotWatchdogKind = "initial" | "post" | "cache-only";

export type RoomSnapshotWatchdogHealth =
  | "initial"
  | "ok"
  | "stale"
  | "recovering"
  | "blocked"
  | "paused";

export type RoomSnapshotWatchdogEpisode = {
  active: boolean;
  kind: RoomSnapshotWatchdogKind | null;
  startedAt: number;
  lastAttemptAt: number;
  attempts: number;
  lastTraceAt: number;
  hardCooldownUntil: number;
};

export type RoomSnapshotWatchdogThresholds = {
  initialStaleMs: number;
  postStaleMs: number;
  cacheOnlyStaleMs: number;
  recoveryCooldownMs: number;
  recoverySlowCooldownMs: number;
  recoveryMaxAttempts: number;
  recoveryHardCooldownMs: number;
  traceIntervalMs: number;
};

export type RoomSnapshotWatchdogInput = {
  now: number;
  trigger: RoomSnapshotWatchdogTrigger;
  joinStatus: "idle" | "joining" | "retrying" | "joined";
  roomAccessBlocked: boolean;
  visible: boolean;
  online: boolean | undefined;
  lastServerSnapshotAt: number | null;
  lastSnapshotWasFromCache: boolean;
  cacheOnlySince: number | null;
  syncStartAt: number;
  episode: RoomSnapshotWatchdogEpisode;
};

export type RoomSnapshotWatchdogDecision = {
  nextHealth: RoomSnapshotWatchdogHealth;
  nextSnapshotAgeMs: number | null;
  nextRecoveryAttempts: number;
  nextEpisode: RoomSnapshotWatchdogEpisode;
  shouldForceRefresh: boolean;
  shouldRestartListener: boolean;
  shouldTrace: boolean;
  staleKind: RoomSnapshotWatchdogKind | null;
  staleAgeMs: number | null;
  staleThresholdMs: number | null;
  cooldownMs: number | null;
  exhausted: boolean;
};

function clampInt(value: number, min: number, max: number): number {
  const safe = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.min(max, Math.max(min, safe));
}

function ensureEpisode(
  prev: RoomSnapshotWatchdogEpisode,
  kind: RoomSnapshotWatchdogKind,
  now: number
): RoomSnapshotWatchdogEpisode {
  if (prev.active && prev.kind === kind) return prev;
  return {
    active: true,
    kind,
    startedAt: now,
    lastAttemptAt: 0,
    attempts: 0,
    lastTraceAt: 0,
    hardCooldownUntil: 0,
  };
}

export function evaluateRoomSnapshotWatchdog(
  input: RoomSnapshotWatchdogInput,
  thresholds: RoomSnapshotWatchdogThresholds
): RoomSnapshotWatchdogDecision {
  if (input.roomAccessBlocked) {
    return {
      nextHealth: "blocked",
      nextSnapshotAgeMs: null,
      nextRecoveryAttempts: 0,
      nextEpisode: input.episode,
      shouldForceRefresh: false,
      shouldRestartListener: false,
      shouldTrace: false,
      staleKind: null,
      staleAgeMs: null,
      staleThresholdMs: null,
      cooldownMs: null,
      exhausted: false,
    };
  }

  if (!input.visible) {
    return {
      nextHealth: "paused",
      nextSnapshotAgeMs: null,
      nextRecoveryAttempts: 0,
      nextEpisode: input.episode,
      shouldForceRefresh: false,
      shouldRestartListener: false,
      shouldTrace: false,
      staleKind: null,
      staleAgeMs: null,
      staleThresholdMs: null,
      cooldownMs: null,
      exhausted: false,
    };
  }

  const online = input.online !== false;
  const hasServerSnapshot = typeof input.lastServerSnapshotAt === "number";

  const kind: RoomSnapshotWatchdogKind = !hasServerSnapshot
    ? "initial"
    : input.lastSnapshotWasFromCache
      ? "cache-only"
      : "post";

  const thresholdMs =
    kind === "initial"
      ? thresholds.initialStaleMs
      : kind === "cache-only"
        ? thresholds.cacheOnlyStaleMs
        : thresholds.postStaleMs;

  const baselineAt =
    kind === "initial"
      ? input.syncStartAt
      : kind === "cache-only"
        ? typeof input.cacheOnlySince === "number"
          ? input.cacheOnlySince
          : input.now
        : (input.lastServerSnapshotAt as number);

  const rawAgeMs = Math.max(0, input.now - baselineAt);
  const ageMs = clampInt(rawAgeMs, 0, Number.MAX_SAFE_INTEGER);

  if (ageMs < thresholdMs) {
    return {
      nextHealth: kind === "initial" ? "initial" : "ok",
      nextSnapshotAgeMs: null,
      nextRecoveryAttempts: 0,
      nextEpisode: input.episode.active ? { ...input.episode, active: false, kind: null } : input.episode,
      shouldForceRefresh: false,
      shouldRestartListener: false,
      shouldTrace: false,
      staleKind: null,
      staleAgeMs: null,
      staleThresholdMs: null,
      cooldownMs: null,
      exhausted: false,
    };
  }

  const episode = ensureEpisode(input.episode, kind, input.now);

  if (!online) {
    return {
      nextHealth: "stale",
      nextSnapshotAgeMs: ageMs,
      nextRecoveryAttempts: episode.attempts,
      nextEpisode: episode,
      shouldForceRefresh: false,
      shouldRestartListener: false,
      shouldTrace: false,
      staleKind: kind,
      staleAgeMs: ageMs,
      staleThresholdMs: thresholdMs,
      cooldownMs: null,
      exhausted: false,
    };
  }

  if (input.now < episode.hardCooldownUntil) {
    return {
      nextHealth: "stale",
      nextSnapshotAgeMs: ageMs,
      nextRecoveryAttempts: episode.attempts,
      nextEpisode: episode,
      shouldForceRefresh: false,
      shouldRestartListener: false,
      shouldTrace: false,
      staleKind: kind,
      staleAgeMs: ageMs,
      staleThresholdMs: thresholdMs,
      cooldownMs: null,
      exhausted: false,
    };
  }

  const maxAttempts = clampInt(thresholds.recoveryMaxAttempts, 1, 20);
  const baseCooldownMs = clampInt(thresholds.recoveryCooldownMs, 200, 120_000);
  const slowCooldownMs = clampInt(thresholds.recoverySlowCooldownMs, baseCooldownMs, 10 * 60_000);

  const slowMode = episode.attempts >= 2;
  const cooldownMs = slowMode ? slowCooldownMs : baseCooldownMs;

  if (episode.lastAttemptAt > 0 && input.now - episode.lastAttemptAt < cooldownMs) {
    return {
      nextHealth: "stale",
      nextSnapshotAgeMs: ageMs,
      nextRecoveryAttempts: episode.attempts,
      nextEpisode: episode,
      shouldForceRefresh: false,
      shouldRestartListener: false,
      shouldTrace: false,
      staleKind: kind,
      staleAgeMs: ageMs,
      staleThresholdMs: thresholdMs,
      cooldownMs,
      exhausted: false,
    };
  }

  if (episode.attempts >= maxAttempts) {
    const hardCooldownMs = clampInt(thresholds.recoveryHardCooldownMs, 1000, 10 * 60_000);
    const exhaustedEpisode: RoomSnapshotWatchdogEpisode = {
      ...episode,
      hardCooldownUntil: input.now + hardCooldownMs,
    };
    return {
      nextHealth: "stale",
      nextSnapshotAgeMs: ageMs,
      nextRecoveryAttempts: episode.attempts,
      nextEpisode: exhaustedEpisode,
      shouldForceRefresh: false,
      shouldRestartListener: false,
      shouldTrace: true,
      staleKind: kind,
      staleAgeMs: ageMs,
      staleThresholdMs: thresholdMs,
      cooldownMs,
      exhausted: true,
    };
  }

  const nextAttempt = clampInt(episode.attempts + 1, 1, maxAttempts);
  const traceIntervalMs = clampInt(thresholds.traceIntervalMs, 5000, 5 * 60_000);
  const shouldTrace = input.now - episode.lastTraceAt > traceIntervalMs;
  const updatedEpisode: RoomSnapshotWatchdogEpisode = {
    ...episode,
    attempts: nextAttempt,
    lastAttemptAt: input.now,
    lastTraceAt: shouldTrace ? input.now : episode.lastTraceAt,
  };

  return {
    nextHealth: "recovering",
    nextSnapshotAgeMs: ageMs,
    nextRecoveryAttempts: nextAttempt,
    nextEpisode: updatedEpisode,
    shouldForceRefresh: true,
    shouldRestartListener: nextAttempt >= 2,
    shouldTrace,
    staleKind: kind,
    staleAgeMs: ageMs,
    staleThresholdMs: thresholdMs,
    cooldownMs,
    exhausted: false,
  };
}

