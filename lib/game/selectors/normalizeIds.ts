const normalizeId = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

// 正規化ヘルパー
export const normalizeIdArray = (arr: unknown): (string | null)[] =>
  Array.isArray(arr) ? (arr as unknown[]).map(normalizeId) : [];

