export type VerificationHealth = {
  backoffMs: number;
  failures: number;
  lastVerifiedAt: number;
  healthScore: number;
};

export const MIN_BACKOFF_MS = 10_000;
export const MAX_BACKOFF_MS = 5 * 60 * 1000;
export const HEALTH_DECAY_MS = 5 * 60 * 1000;
export const HEALTH_RECOVERY_STEP = 0.25;
export const HEALTH_PENALTY_STEP = 0.5;
export const DEFAULT_HEALTH = 1;

export function getVerificationHealth(
  store: Map<string, VerificationHealth>,
  roomId: string,
  now: number
): VerificationHealth {
  let entry = store.get(roomId);
  if (!entry) {
    entry = {
      backoffMs: MIN_BACKOFF_MS,
      failures: 0,
      lastVerifiedAt: 0,
      healthScore: DEFAULT_HEALTH,
    };
    store.set(roomId, entry);
    return entry;
  }

  if (entry.lastVerifiedAt > 0) {
    const elapsed = now - entry.lastVerifiedAt;
    if (elapsed > HEALTH_DECAY_MS && entry.healthScore < DEFAULT_HEALTH) {
      entry.healthScore = Math.min(
        DEFAULT_HEALTH,
        entry.healthScore + HEALTH_RECOVERY_STEP
      );
      entry.failures = Math.max(0, entry.failures - 1);
      entry.backoffMs = Math.max(MIN_BACKOFF_MS, entry.backoffMs / 2);
      entry.lastVerifiedAt = now;
    }
  }

  return entry;
}

export function updateHealthOnSuccess(
  entry: VerificationHealth,
  now: number
): VerificationHealth {
  entry.healthScore = Math.min(DEFAULT_HEALTH, entry.healthScore + 0.25);
  entry.failures = 0;
  entry.backoffMs = Math.max(MIN_BACKOFF_MS, entry.backoffMs / 2);
  entry.lastVerifiedAt = now;
  return entry;
}

export function updateHealthOnFailure(
  entry: VerificationHealth,
  now: number
): VerificationHealth {
  entry.failures += 1;
  entry.healthScore = Math.max(0, entry.healthScore - HEALTH_PENALTY_STEP);
  entry.backoffMs = Math.min(
    MAX_BACKOFF_MS,
    Math.max(MIN_BACKOFF_MS, entry.backoffMs * 2)
  );
  entry.lastVerifiedAt = now;
  return entry;
}

export function shouldSkipVerification(
  entry: VerificationHealth,
  lastCheckAt: number,
  now: number
): boolean {
  if (now - lastCheckAt < entry.backoffMs) return true;
  if (entry.healthScore === 0) return true;
  return false;
}
