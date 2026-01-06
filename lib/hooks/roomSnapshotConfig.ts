const DEFAULT_ENSURE_MEMBER_INTERVAL_MS = 90_000;
const parsedEnsureMemberInterval = Number(
  process.env.NEXT_PUBLIC_ENSURE_MEMBER_MIN_INTERVAL_MS ??
    DEFAULT_ENSURE_MEMBER_INTERVAL_MS
);

export const ENSURE_MEMBER_MIN_INTERVAL_MS =
  Number.isFinite(parsedEnsureMemberInterval) && parsedEnsureMemberInterval > 0
    ? parsedEnsureMemberInterval
    : DEFAULT_ENSURE_MEMBER_INTERVAL_MS;

export const ROOM_SNAPSHOT_DEFER_ENABLED =
  process.env.NEXT_PUBLIC_PERF_ROOM_SNAPSHOT_DEFER === "1";

export const MAX_JOIN_RETRIES = Number(process.env.NEXT_PUBLIC_ROOM_JOIN_RETRIES ?? 5);
// 連続 join での負荷を抑えるため既定値をやや長めに設定（env で上書き可能）
export const BASE_JOIN_RETRY_DELAY_MS = 700;
export const MAX_JOIN_RETRY_DELAY_MS = Number(
  process.env.NEXT_PUBLIC_ROOM_JOIN_RETRY_MAX_DELAY_MS ?? 7000
);
export const JOIN_RETRY_BACKOFF_FACTOR = 2;

export const DEFAULT_ROOM_SNAPSHOT_INITIAL_STALE_MS = 20_000;
export const DEFAULT_ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS = 2000;
export const DEFAULT_ROOM_SNAPSHOT_RECOVERY_COOLDOWN_MS = 4000;
export const DEFAULT_ROOM_SNAPSHOT_RECOVERY_SLOW_COOLDOWN_MS = 30_000;
export const DEFAULT_ROOM_SNAPSHOT_POST_STALE_MS = 5 * 60_000;
export const DEFAULT_ROOM_SNAPSHOT_CACHE_ONLY_STALE_MS = 12_000;
export const DEFAULT_ROOM_SNAPSHOT_RESUME_WINDOW_MS = 15_000;
export const DEFAULT_ROOM_SNAPSHOT_CACHE_ONLY_RESUME_STALE_MS = 2000;
export const DEFAULT_ROOM_SNAPSHOT_RECOVERY_MAX_ATTEMPTS = 6;
export const DEFAULT_ROOM_SNAPSHOT_RECOVERY_HARD_COOLDOWN_MS = 60_000;
export const DEFAULT_ROOM_SNAPSHOT_TRACE_INTERVAL_MS = 20_000;

export const ROOM_SNAPSHOT_INITIAL_STALE_MS = (() => {
  const parsed = Number(
    process.env.NEXT_PUBLIC_ROOM_SNAPSHOT_INITIAL_STALE_MS ??
      DEFAULT_ROOM_SNAPSHOT_INITIAL_STALE_MS
  );
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_ROOM_SNAPSHOT_INITIAL_STALE_MS;
})();

export const ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS = (() => {
  const parsed = Number(
    process.env.NEXT_PUBLIC_ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS ??
      DEFAULT_ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS
  );
  return Number.isFinite(parsed) && parsed > 200
    ? parsed
    : DEFAULT_ROOM_SNAPSHOT_WATCHDOG_INTERVAL_MS;
})();

export const ROOM_SNAPSHOT_POST_STALE_MS = (() => {
  const parsed = Number(
    process.env.NEXT_PUBLIC_ROOM_SNAPSHOT_POST_STALE_MS ??
      DEFAULT_ROOM_SNAPSHOT_POST_STALE_MS
  );
  return Number.isFinite(parsed) && parsed > 1000
    ? parsed
    : DEFAULT_ROOM_SNAPSHOT_POST_STALE_MS;
})();

export const ROOM_SNAPSHOT_CACHE_ONLY_STALE_MS = (() => {
  const parsed = Number(
    process.env.NEXT_PUBLIC_ROOM_SNAPSHOT_CACHE_ONLY_STALE_MS ??
      DEFAULT_ROOM_SNAPSHOT_CACHE_ONLY_STALE_MS
  );
  return Number.isFinite(parsed) && parsed > 500
    ? parsed
    : DEFAULT_ROOM_SNAPSHOT_CACHE_ONLY_STALE_MS;
})();

export const ROOM_SNAPSHOT_RESUME_WINDOW_MS = (() => {
  const parsed = Number(
    process.env.NEXT_PUBLIC_ROOM_SNAPSHOT_RESUME_WINDOW_MS ??
      DEFAULT_ROOM_SNAPSHOT_RESUME_WINDOW_MS
  );
  return Number.isFinite(parsed) && parsed >= 1000
    ? Math.min(60_000, Math.max(1000, Math.floor(parsed)))
    : DEFAULT_ROOM_SNAPSHOT_RESUME_WINDOW_MS;
})();

export const ROOM_SNAPSHOT_CACHE_ONLY_RESUME_STALE_MS = (() => {
  const parsed = Number(
    process.env.NEXT_PUBLIC_ROOM_SNAPSHOT_CACHE_ONLY_RESUME_STALE_MS ??
      DEFAULT_ROOM_SNAPSHOT_CACHE_ONLY_RESUME_STALE_MS
  );
  return Number.isFinite(parsed) && parsed >= 200
    ? Math.min(20_000, Math.max(200, Math.floor(parsed)))
    : DEFAULT_ROOM_SNAPSHOT_CACHE_ONLY_RESUME_STALE_MS;
})();

export const ROOM_SNAPSHOT_RECOVERY_MAX_ATTEMPTS = (() => {
  const parsed = Number(
    process.env.NEXT_PUBLIC_ROOM_SNAPSHOT_RECOVERY_MAX_ATTEMPTS ??
      DEFAULT_ROOM_SNAPSHOT_RECOVERY_MAX_ATTEMPTS
  );
  return Number.isFinite(parsed) && parsed >= 1
    ? Math.min(20, Math.max(1, Math.floor(parsed)))
    : DEFAULT_ROOM_SNAPSHOT_RECOVERY_MAX_ATTEMPTS;
})();

export const ROOM_SNAPSHOT_RECOVERY_HARD_COOLDOWN_MS = (() => {
  const parsed = Number(
    process.env.NEXT_PUBLIC_ROOM_SNAPSHOT_RECOVERY_HARD_COOLDOWN_MS ??
      DEFAULT_ROOM_SNAPSHOT_RECOVERY_HARD_COOLDOWN_MS
  );
  return Number.isFinite(parsed) && parsed >= 1000
    ? Math.min(10 * 60_000, Math.max(1000, Math.floor(parsed)))
    : DEFAULT_ROOM_SNAPSHOT_RECOVERY_HARD_COOLDOWN_MS;
})();

