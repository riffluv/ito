import type { PlayerSnapshot, RoomDoc } from "@/lib/types";

export function collectSnapshotReferenceIds(params: {
  list: RoomDoc["order"] extends { list?: infer T } ? T : unknown;
  proposal: RoomDoc["order"] extends { proposal?: infer T } ? T : unknown;
}): Set<string> {
  const ids = new Set<string>();

  const register = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (trimmed) ids.add(trimmed);
  };

  if (Array.isArray(params.list)) {
    params.list.forEach(register);
  }
  if (Array.isArray(params.proposal)) {
    params.proposal.forEach(register);
  }

  return ids;
}

export function retainOrderSnapshots(params: {
  snapshots: Record<string, PlayerSnapshot>;
  referenceIds: ReadonlySet<string>;
  maxRetained: number;
}): Record<string, PlayerSnapshot> | null {
  const orderedEntries: [string, PlayerSnapshot][] = [];
  for (const [id, snapshot] of Object.entries(params.snapshots)) {
    if (!params.referenceIds.has(id)) continue;
    orderedEntries.push([id, snapshot]);
  }

  if (orderedEntries.length > params.maxRetained) {
    orderedEntries.splice(0, orderedEntries.length - params.maxRetained);
  }

  if (orderedEntries.length <= 0) return null;
  return Object.fromEntries(orderedEntries);
}

export function pruneLeaveDedupeEntries(params: {
  rawEntries: Record<string, number> | undefined;
  now: number;
  pruneMs: number;
  windowMs: number;
  userId: string;
}): { entries: Record<string, number>; skipNotification: boolean } {
  const entries: Record<string, number> = {};

  const raw = params.rawEntries ?? {};
  for (const key of Object.keys(raw)) {
    const ts = raw[key];
    if (typeof ts === "number" && params.now - ts <= params.pruneMs) {
      entries[key] = ts;
    }
  }

  const lastTs = entries[params.userId];
  const skipNotification =
    typeof lastTs === "number" && params.now - lastTs < params.windowMs;

  entries[params.userId] = params.now;

  return { entries, skipNotification };
}

