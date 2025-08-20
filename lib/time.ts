export function toMillis(value: any): number {
  const ls: any = value;
  if (!ls) return 0;
  return ls?.toMillis
    ? ls.toMillis()
    : ls instanceof Date
    ? ls.getTime()
    : typeof ls === "number"
    ? ls
    : 0;
}

export const ACTIVE_WINDOW_MS = 60_000;

export function isActive(
  lastSeen: any,
  now: number = Date.now(),
  windowMs: number = ACTIVE_WINDOW_MS
): boolean {
  const ms = toMillis(lastSeen);
  return ms >= now - windowMs;
}
