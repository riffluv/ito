const isStringId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export function countActiveProposalIds(proposal: (string | null | undefined)[]): number {
  return proposal.reduce((acc, id) => (isStringId(id) ? acc + 1 : acc), 0);
}

export function isGameActiveStatus(roomStatus: string | null | undefined): boolean {
  return roomStatus === "clue" || roomStatus === "reveal" || roomStatus === "finished";
}

export function computeSlotCountTarget(
  slotCount: number | null | undefined,
  availableEligibleCount: number
): number {
  const explicit = typeof slotCount === "number" && slotCount > 0 ? slotCount : 0;
  const eligible = Number.isFinite(availableEligibleCount) ? Math.max(0, availableEligibleCount) : 0;
  return Math.max(explicit, eligible);
}

export function buildPlaceholderSlots(params: {
  boardProposal: (string | null | undefined)[];
  missingPlayerIds: string[];
}): { slot: number; cardId: string }[] {
  if (!Array.isArray(params.missingPlayerIds) || params.missingPlayerIds.length === 0) {
    return [];
  }
  const placeholderSet = new Set(params.missingPlayerIds.filter(isStringId));
  if (placeholderSet.size === 0) {
    return [];
  }

  return params.boardProposal
    .map((cardId, idx) => (isStringId(cardId) && placeholderSet.has(cardId) ? { slot: idx, cardId } : null))
    .filter((entry): entry is { slot: number; cardId: string } => entry !== null);
}
