export function normalizeProposalList(proposal: unknown): string[] {
  if (!Array.isArray(proposal) || proposal.length === 0) {
    return [];
  }
  return proposal.filter((value): value is string => typeof value === "string" && value.length > 0);
}

