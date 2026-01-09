type OnlineUids = (string | null | undefined)[] | null | undefined;

export function buildResetKeepIds(params: {
  roundIds?: string[] | null;
  onlineUids?: OnlineUids;
  includeOnline?: boolean;
}): { keep: string[]; keepSet: Set<string> } {
  const keepSet = new Set<string>();

  if (Array.isArray(params.roundIds)) {
    params.roundIds.forEach((id) => {
      if (typeof id === "string" && id.trim()) keepSet.add(id);
    });
  }
  if (params.includeOnline && Array.isArray(params.onlineUids)) {
    params.onlineUids.forEach((id) => {
      if (typeof id === "string" && id.trim()) keepSet.add(id);
    });
  }

  return { keep: Array.from(keepSet), keepSet };
}

export function parseResetPruneFlag(raw: unknown): boolean {
  try {
    const normalized = (raw ?? "").toString().toLowerCase();
    if (!normalized) return true;
    return !(normalized === "0" || normalized === "false");
  } catch {
    return true;
  }
}

export function computePruneTargets(params: {
  roundIds?: string[] | null;
  keepSet: ReadonlySet<string>;
}): string[] {
  if (!Array.isArray(params.roundIds) || params.roundIds.length === 0) return [];
  return params.roundIds.filter((id) => !params.keepSet.has(id));
}

