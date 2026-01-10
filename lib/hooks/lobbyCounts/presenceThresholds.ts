export const DEFAULT_LOBBY_STALE_MS = 35_000;
export const DEFAULT_ACCEPT_FRESH_MS = 5_000;

export function parseEnvBooleanFlag(raw: string | undefined | null): boolean {
  const normalized = (raw || "").toString().trim().toLowerCase();
  if (!normalized) return false;
  return normalized === "1" || normalized === "true";
}

export function parseEnvNumber(raw: string | undefined | null): number | null {
  const normalized = (raw || "").toString().trim();
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function computeLobbyStaleMs(params: {
  envStaleMs: number | null;
  presenceStaleMs: number;
  heartbeatMs: number;
  minExtraMs?: number;
  defaultStaleMs?: number;
}): number {
  const minExtraMs = params.minExtraMs ?? 5_000;
  const defaultStaleMs = params.defaultStaleMs ?? DEFAULT_LOBBY_STALE_MS;
  const minStale = params.heartbeatMs + minExtraMs;
  const requested =
    typeof params.envStaleMs === "number" && Number.isFinite(params.envStaleMs) && params.envStaleMs > 0
      ? params.envStaleMs
      : defaultStaleMs;
  return Math.min(params.presenceStaleMs, Math.max(minStale, requested));
}

export function computeZeroFreezeMsDefault(params: {
  envZeroFreezeMs: number | null;
  lobbyStaleMs: number;
  minFreezeMs?: number;
  extraMs?: number;
}): number {
  if (
    typeof params.envZeroFreezeMs === "number" &&
    Number.isFinite(params.envZeroFreezeMs) &&
    params.envZeroFreezeMs > 0
  ) {
    return params.envZeroFreezeMs;
  }
  const minFreezeMs = params.minFreezeMs ?? 20_000;
  const extraMs = params.extraMs ?? 5_000;
  return Math.max(minFreezeMs, params.lobbyStaleMs + extraMs);
}

