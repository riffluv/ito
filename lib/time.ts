import { Timestamp, FieldValue } from 'firebase/firestore';

export function toMillis(value: Timestamp | Date | number | FieldValue | null | undefined): number {
  const ls = value;
  if (!ls) return 0;
  // FieldValueの場合は0を返す（サーバータイムスタンプなど）
  if (ls && typeof ls === 'object' && 'isEqual' in ls) return 0;
  if (ls && typeof ls === 'object' && 'toMillis' in ls && 'seconds' in ls) {
    return (ls as unknown as Timestamp).toMillis();
  }
  if (ls instanceof Date) {
    return ls.getTime();
  }
  if (typeof ls === "number") {
    return ls;
  }
  return 0;
}

export const ACTIVE_WINDOW_MS = 60_000;

export function isActive(
  lastSeen: Timestamp | Date | number | FieldValue | null | undefined,
  now: number = Date.now(),
  windowMs: number = ACTIVE_WINDOW_MS
): boolean {
  const ms = toMillis(lastSeen);
  return ms >= now - windowMs;
}
