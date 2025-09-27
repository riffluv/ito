import { FieldValue, Timestamp } from "firebase/firestore";

export function toMillis(
  value: Timestamp | Date | number | FieldValue | null | undefined
): number {
  const ls = value;
  if (!ls) return 0;

  if (ls instanceof Timestamp) {
    return ls.toMillis();
  }

  if (ls instanceof Date) {
    return ls.getTime();
  }

  if (typeof ls === "number") {
    return ls;
  }

  if (typeof ls === "object") {
    if ("toMillis" in ls && typeof (ls as Timestamp).toMillis === "function") {
      return (ls as Timestamp).toMillis();
    }

    // FieldValue（サーバータイムスタンプなど）は数値化できないため 0 を返す
    if ("isEqual" in ls && !("toMillis" in ls)) {
      return 0;
    }
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
