// Utility functions for sort-submit mode only
// Sequential mode has been removed

export type ResolveMode = "sort-submit";

// 開発用簡易テレメトリ (prod では noop)
function devMetric(name: string) {
  if (process.env.NODE_ENV === "production") return;
  const g: any = globalThis as any;
  g.__ITO_DEV_STATS ||= {};
  g.__ITO_DEV_STATS[name] = (g.__ITO_DEV_STATS[name] || 0) + 1;
}

export function normalizeResolveMode(mode: unknown): ResolveMode {
  // Always return sort-submit as it's the only supported mode now
  devMetric("normalize:sort-submit");
  return "sort-submit";
}

export function isSortSubmit(mode: unknown): mode is "sort-submit" {
  // Always true now that sequential mode is removed
  return true;
}

export function isSequential(mode: unknown): mode is "sequential" {
  // Always false - sequential mode removed
  return false;
}

export function computeAllSubmitted(params: {
  mode: unknown;
  eligibleIds?: string[];
  proposal?: string[];
}): boolean {
  // Always use sort-submit logic since sequential is removed
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
  const { canDecide, ready, placed } = params;
  if (!canDecide || !ready || placed) return false;
  // Always allow submission for sort-submit mode (no cluesReady gate)
  return true;
}
