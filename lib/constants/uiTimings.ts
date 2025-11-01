const parsePositiveMs = (value: string | undefined | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

const resolveMs = (envKeys: string[], fallback: number): number => {
  for (const key of envKeys) {
    const resolved = parsePositiveMs(process.env[key]);
    if (resolved !== null) return resolved;
  }
  return fallback;
};

export const PRUNE_PROPOSAL_DEBOUNCE_MS = 400;

export const PRESENCE_DISAPPEAR_GRACE_MS = resolveMs(
  ["NEXT_PUBLIC_PRESENCE_DISAPPEAR_GRACE_MS", "PRESENCE_DISAPPEAR_GRACE_MS"],
  5_000
);
