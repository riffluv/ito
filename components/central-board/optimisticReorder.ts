const isStringId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export const buildProposalSignature = (values: (string | null)[]) => {
  if (!values || values.length === 0) {
    return "";
  }
  return values
    .map((value) => (typeof value === "string" && value.length > 0 ? value : "_"))
    .join("|");
};

export const prunePendingSlotsInPlace = (
  slots: (string | null | undefined)[]
): (string | null)[] => {
  for (let idx = 0; idx < slots.length; idx += 1) {
    if (typeof slots[idx] === "undefined") {
      slots[idx] = null;
    }
  }
  while (slots.length > 0) {
    const tail = slots[slots.length - 1];
    if (tail === null || typeof tail === "undefined") {
      slots.pop();
      continue;
    }
    break;
  }
  return slots as (string | null)[];
};

export function buildOptimisticStateKey(params: {
  optimisticProposal: (string | null)[] | null | undefined;
  pending: (string | null | undefined)[];
  optimisticReturningIds: string[];
}): string {
  const pendingHasContent = params.pending.some(isStringId);
  const pendingSnapshot = prunePendingSlotsInPlace([...params.pending]);
  const pendingSignature = pendingHasContent ? buildProposalSignature(pendingSnapshot) : "";
  const returningKey =
    params.optimisticReturningIds.length > 0 ? params.optimisticReturningIds.join(",") : "";
  const optimisticSignature = params.optimisticProposal
    ? buildProposalSignature(params.optimisticProposal)
    : "";
  return [optimisticSignature, pendingSignature, returningKey].join("#");
}

export function sanitizeOptimisticProposal(params: {
  optimisticProposal: (string | null)[] | null | undefined;
  serverProposal: (string | null | undefined)[] | null | undefined;
}): (string | null)[] | null {
  if (!params.optimisticProposal) return null;
  if (!Array.isArray(params.serverProposal)) return null;

  const serverSet = new Set(params.serverProposal.filter(isStringId));
  const sanitized = params.optimisticProposal.map((id) =>
    isStringId(id) && serverSet.has(id) ? id : null
  );
  prunePendingSlotsInPlace(sanitized);
  return sanitized.length > 0 ? sanitized : null;
}

export function buildRenderedProposalForSignature(params: {
  activeProposal: (string | null)[];
  optimisticProposal: (string | null)[] | null | undefined;
  pending: (string | null | undefined)[];
  optimisticReturningIds: string[];
}): (string | null)[] {
  const base = (params.optimisticProposal ?? params.activeProposal).slice();
  const working = base.slice();

  const pendingIndexById = new Map<string, number>();
  params.pending.forEach((value, idx) => {
    if (isStringId(value)) {
      pendingIndexById.set(value, idx);
    }
  });

  if (pendingIndexById.size > 0) {
    let maxIndex = working.length - 1;
    pendingIndexById.forEach((idx) => {
      if (idx > maxIndex) maxIndex = idx;
    });
    while (working.length <= maxIndex) {
      working.push(null);
    }
    pendingIndexById.forEach((idx, cardId) => {
      const existingIdx = working.findIndex((value) => value === cardId);
      if (existingIdx >= 0 && existingIdx !== idx) {
        working[existingIdx] = null;
      }
      working[idx] = cardId;
    });
  }

  if (params.optimisticReturningIds.length > 0) {
    const returning = new Set(params.optimisticReturningIds);
    for (let i = 0; i < working.length; i += 1) {
      const value = working[i];
      if (isStringId(value) && returning.has(value)) {
        working[i] = null;
      }
    }
  }

  return prunePendingSlotsInPlace(working);
}

const relocateDisplacedId = (
  draft: (string | null)[],
  displacedId: string,
  forbiddenIndex: number
) => {
  const emptyIndex = draft.findIndex(
    (value, idx) => (value === null || typeof value === "undefined") && idx !== forbiddenIndex
  );
  if (emptyIndex >= 0) {
    draft[emptyIndex] = displacedId;
    return;
  }
  draft.push(displacedId);
};

export function buildOptimisticProposalSnapshot(
  current: (string | null)[] | null | undefined,
  playerId: string,
  targetIndex: number
): (string | null)[] | null {
  const base = Array.isArray(current) ? current : [];
  const clampedTarget = Math.max(0, targetIndex);
  const fromIndex = base.findIndex((id) => id === playerId);

  if (fromIndex === clampedTarget && clampedTarget < base.length) {
    return null;
  }

  const working = base.slice();
  const maxLength = Math.max(working.length, clampedTarget + 1);
  while (working.length < maxLength) {
    working.push(null);
  }

  const displaced = working[clampedTarget];

  if (fromIndex < 0) {
    if (isStringId(displaced) && displaced !== playerId) {
      relocateDisplacedId(working, displaced, clampedTarget);
    }
    working[clampedTarget] = playerId;
    return prunePendingSlotsInPlace(working);
  }

  working[clampedTarget] = playerId;

  if (isStringId(displaced) && displaced !== playerId) {
    working[fromIndex] = displaced;
  } else {
    working[fromIndex] = null;
  }

  return prunePendingSlotsInPlace(working);
}
