// Utility functions for resolveMode handling (sequential vs sort-submit)
// Centralizes normalization & shared predicates to avoid scattered string literals.

export type ResolveMode = "sequential" | "sort-submit";

// 開発用簡易テレメトリ (prod では noop)
function devMetric(name: string) {
  if (process.env.NODE_ENV === "production") return;
  const g: any = globalThis as any;
  g.__ITO_DEV_STATS ||= {};
  g.__ITO_DEV_STATS[name] = (g.__ITO_DEV_STATS[name] || 0) + 1;
}

export function normalizeResolveMode(mode: unknown): ResolveMode {
  const normalized = mode === "sort-submit" ? "sort-submit" : "sequential";
  devMetric(`normalize:${normalized}`);
  return normalized;
}

export function isSortSubmit(mode: unknown): mode is "sort-submit" {
  return normalizeResolveMode(mode) === "sort-submit";
}

export function isSequential(mode: unknown): mode is "sequential" {
  return normalizeResolveMode(mode) === "sequential";
}

export function computeAllSubmitted(params: {
  mode: unknown;
  eligibleIds?: string[];
  proposal?: string[];
}): boolean {
  if (!isSortSubmit(params.mode)) return false;
  const { eligibleIds, proposal } = params;
  if (!Array.isArray(eligibleIds) || !Array.isArray(proposal)) return false;
  if (eligibleIds.length === 0) return false;
  const all = eligibleIds.length === proposal.length;
  if (all) devMetric("allSubmitted");
  return all;
}

export function canSubmitCard(params: {
  mode: unknown;
  canDecide: boolean;
  ready: boolean;
  placed: boolean;
  cluesReady?: boolean;
}): boolean {
  const { mode, canDecide, ready, placed, cluesReady } = params;
  if (!canDecide || !ready || placed) return false;
  if (isSortSubmit(mode)) return true; // always allowed before evaluate
  const ok = !!cluesReady; // sequential gate
  if (ok) devMetric("canSubmitSequential");
  return ok;
}
