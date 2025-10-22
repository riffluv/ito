const parseMs = (value: string | undefined | null): number | null => {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.floor(num);
};

const pickMs = (keys: string[], fallback: number): number => {
  for (const key of keys) {
    const resolved = parseMs(process.env[key]);
    if (resolved !== null) return resolved;
  }
  return fallback;
};

export const PRESENCE_HEARTBEAT_MS = pickMs(
  ["NEXT_PUBLIC_PRESENCE_HEARTBEAT_MS", "PRESENCE_HEARTBEAT_MS"],
  20_000
);

export const PRESENCE_STALE_MS = (() => {
  const resolved = pickMs(
    ["NEXT_PUBLIC_PRESENCE_STALE_MS", "PRESENCE_STALE_MS"],
    120_000
  );
  const minValue = PRESENCE_HEARTBEAT_MS + 5_000;
  return resolved < minValue ? minValue : resolved;
})();

export const MAX_CLOCK_SKEW_MS = pickMs(
  ["NEXT_PUBLIC_PRESENCE_MAX_CLOCK_SKEW_MS", "PRESENCE_MAX_CLOCK_SKEW_MS"],
  30_000
);

export const PRESENCE_HEARTBEAT_RETRY_DELAYS_MS = Object.freeze([3_000, 9_000, 27_000]);

export const PRESENCE_CLEANUP_INTERVAL_MS = pickMs(
  ["PRESENCE_CLEANUP_INTERVAL_MS"],
  60_000
);
