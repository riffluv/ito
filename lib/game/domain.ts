import type { RoomDoc } from "@/lib/types";

export type DealCandidate = {
  id: string;
  uid?: string; // compatibility with legacy shapes
  isActive?: boolean;
  lastSeen?: number | Date | unknown | null;
  isHost?: boolean;
  seatHistoryIndex?: number | null;
};

const ACTIVE_WINDOW_MS = 20_000;

const isActive = (lastSeen: DealCandidate["lastSeen"], now: number) => {
  if (lastSeen instanceof Date) return now - lastSeen.getTime() <= ACTIVE_WINDOW_MS;
  if (typeof lastSeen === "number" && Number.isFinite(lastSeen)) {
    return now - lastSeen <= ACTIVE_WINDOW_MS;
  }
  return false;
};

export function selectDealTargetPlayers(
  candidates: DealCandidate[],
  presenceUids: string[] | null | undefined,
  now: number
): DealCandidate[] {
  const activeByRecency = candidates.filter((p) =>
    isActive(p.lastSeen ?? null, now)
  );
  const fallbackPool =
    activeByRecency.length > 0 ? activeByRecency : candidates;
  if (Array.isArray(presenceUids) && presenceUids.length > 0) {
    const presenceSet = new Set(presenceUids);
    const online = fallbackPool.filter((p) => presenceSet.has(p.id));
    if (online.length > 0) {
      const others = fallbackPool.filter((p) => !presenceSet.has(p.id));
      return [...online, ...others];
    }
  }
  return fallbackPool;
}

export type DealPayload = {
  seed: string;
  min: number;
  max: number;
  players: string[];
  seatHistory: Record<string, number>;
  numbers: Record<string, number | null>;
};

export function buildDealPayload(
  playerIds: string[],
  seed: string,
  min: number,
  max: number,
  generatedNumbers: number[]
): DealPayload {
  const seatHistory = deriveSeatHistory(playerIds);
  const numbers = playerIds.reduce<Record<string, number | null>>((acc, id, index) => {
    acc[id] = typeof generatedNumbers[index] === "number" ? generatedNumbers[index] : null;
    return acc;
  }, {});

  return {
    seed,
    min,
    max,
    players: playerIds,
    seatHistory,
    numbers,
  };
}

export function buildSeatHistory(players: string[], existing: Record<string, number> = {}): Record<string, number> {
  const base = { ...existing };
  players.forEach((id, index) => {
    if (typeof base[id] !== "number") {
      base[id] = index;
    }
  });
  return base;
}

export function normalizeProposalCompact(
  proposal: (string | null | undefined)[],
  maxCount: number
): (string | null)[] {
  return normalizeProposal(proposal, maxCount);
}

export function diffProposal(
  before: (string | null)[],
  after: (string | null)[]
): { changedSlots: number; nullCount: number } {
  const length = Math.max(before.length, after.length);
  let changedSlots = 0;
  let nullCount = 0;
  for (let i = 0; i < length; i += 1) {
    const b = i < before.length ? before[i] : null;
    const a = i < after.length ? after[i] : null;
    if (a === null) nullCount += 1;
    if (b !== a) changedSlots += 1;
  }
  return { changedSlots, nullCount };
}

export function normalizeProposal(
  values: (string | null | undefined)[],
  maxCount: number
): (string | null)[] {
  if (maxCount <= 0) return [];
  const limited: (string | null)[] = values.slice(0, maxCount).map((value) =>
    typeof value === "string" && value.length > 0 ? value : null
  );
  while (limited.length > 0 && limited[limited.length - 1] === null) {
    limited.pop();
  }
  return limited;
}

export const hasValidTopic = (room: RoomDoc): boolean =>
  typeof room.topic === "string" && room.topic.length > 0;

export function deriveSeatHistory(
  playerIds: readonly string[]
): Record<string, number> {
  const history: Record<string, number> = {};
  playerIds.forEach((id, index) => {
    history[id] = index;
  });
  return history;
}
