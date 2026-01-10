export function buildEligibleIdSet(ids: unknown): Set<string> {
  const set = new Set<string>();
  const list = Array.isArray(ids) ? (ids as unknown[]) : [];
  for (const id of list) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (trimmed) set.add(trimmed);
  }
  return set;
}

export function filterProposalByEligible(proposal: unknown, eligible: ReadonlySet<string>): string[] {
  const raw = Array.isArray(proposal) ? (proposal as unknown[]) : [];
  return raw.filter((id): id is string => typeof id === "string" && eligible.has(id));
}

