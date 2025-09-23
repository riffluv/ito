export type HostReassignContext = {
  currentHostId?: string | null;
  leavingUid?: string | null;
  remainingIds: readonly string[];
};

function normalizeId(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function shouldReassignHost({
  currentHostId,
  leavingUid,
  remainingIds,
}: HostReassignContext): boolean {
  const normalizedRemaining = Array.from(
    new Set(remainingIds.map((id) => normalizeId(id)).filter((id) => id.length > 0))
  );
  if (normalizedRemaining.length === 0) return false;

  const current = normalizeId(currentHostId ?? null);
  if (!current) return true;

  if (normalizedRemaining.includes(current)) {
    return false;
  }

  const leaving = normalizeId(leavingUid ?? null);
  if (leaving && leaving === current) {
    return true;
  }

  return true;
}
