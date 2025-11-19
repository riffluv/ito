const isStringId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

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
