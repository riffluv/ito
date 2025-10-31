import { evaluateSorted } from "@/lib/game/rules";

type SortedEvaluation = ReturnType<typeof evaluateSorted>;

interface SortedRevealCacheEntry {
  signature: string;
  prefixEvaluations: Map<number, SortedEvaluation>;
  createdAt: number;
}

const sortedRevealCache = new Map<string, SortedRevealCacheEntry>();

function normalizeNumberValue(value: number | null | undefined): string {
  if (typeof value === "number") return String(value);
  return value == null ? "null" : "invalid";
}

function createSignature(
  list: readonly string[],
  numbers: Record<string, number | null | undefined>
): string {
  const orderedNumbers = Object.keys(numbers)
    .sort()
    .map((id) => `${id}:${normalizeNumberValue(numbers[id])}`)
    .join("|");
  return `${list.join(",")}#${orderedNumbers}`;
}

export function primeSortedRevealCache(
  roomId: string,
  list: readonly string[],
  numbers: Record<string, number | null | undefined>
): void {
  if (list.length === 0) return;
  const signature = createSignature(list, numbers);
  const existing = sortedRevealCache.get(roomId);
  if (existing && existing.signature === signature) return;

  const prefixEvaluations = new Map<number, SortedEvaluation>();
  for (let i = 2; i <= list.length; i += 1) {
    const prefix = list.slice(0, i);
    prefixEvaluations.set(i, evaluateSorted(prefix, numbers));
  }

  sortedRevealCache.set(roomId, {
    signature,
    prefixEvaluations,
    createdAt: Date.now(),
  });
}

export function readSortedRevealCache(
  roomId: string,
  index: number
): SortedEvaluation | null {
  const entry = sortedRevealCache.get(roomId);
  if (!entry) return null;
  return entry.prefixEvaluations.get(index) ?? null;
}

export function clearSortedRevealCache(roomId: string): void {
  sortedRevealCache.delete(roomId);
}

export function touchSortedRevealCache(
  roomId: string,
  list: readonly string[],
  numbers: Record<string, number | null | undefined>
): void {
  primeSortedRevealCache(roomId, list, numbers);
}

export function getSortedRevealCacheSize(): number {
  return sortedRevealCache.size;
}
