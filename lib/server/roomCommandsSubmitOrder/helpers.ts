export function isNonEmptyNumbersObject(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  try {
    return Object.keys(value as Record<string, unknown>).length > 0;
  } catch {
    return false;
  }
}

