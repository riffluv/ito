type TimestampLike = { toMillis: () => number };

const hasToMillis = (value: unknown): value is TimestampLike =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { toMillis?: unknown }).toMillis === "function";

export function resolveRevealedMs(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.getTime();
  }
  if (hasToMillis(value)) {
    try {
      return value.toMillis();
    } catch {
      return null;
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

