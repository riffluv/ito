import { generateDeterministicNumbers } from "@/lib/game/random";

export type DealCandidate = {
  id: string;
  uid?: string; // compatibility with legacy shapes
  isActive?: boolean;
  lastSeen?: number | Date | unknown | null;
  isHost?: boolean;
  seatHistoryIndex?: number | null;
};

const ACTIVE_WINDOW_MS = 30_000;

const isActive = (lastSeen: DealCandidate["lastSeen"], now: number) => {
  // Firestore Timestamp 対応 (duck-typing)
  if (
    lastSeen &&
    typeof (lastSeen as { toMillis?: () => number }).toMillis === "function"
  ) {
    try {
      const ms = (lastSeen as { toMillis: () => number }).toMillis();
      return now - ms <= ACTIVE_WINDOW_MS;
    } catch {
      // fall through
    }
  }
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
  const activeByRecency = candidates.filter((p) => isActive(p.lastSeen ?? null, now));
  const presenceSet =
    Array.isArray(presenceUids) && presenceUids.length > 0 ? new Set(presenceUids) : null;

  if (presenceSet) {
    const online = candidates.filter((p) => presenceSet.has(p.id));
    if (online.length > 0) return online; // presenceを真とする
  }
  if (activeByRecency.length > 0) return activeByRecency;
  return candidates;
}

export type DealPayload = {
  seed: string;
  min: number;
  max: number;
  players: string[];
  seatHistory: Record<string, number>;
  numbers: Record<string, number | null>;
};

export function deriveSeatHistory(playerIds: readonly string[]): Record<string, number> {
  const history: Record<string, number> = {};
  playerIds.forEach((id, index) => {
    history[id] = index;
  });
  return history;
}

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

export function buildSeatHistory(
  players: string[],
  existing: Record<string, number> = {}
): Record<string, number> {
  const base = { ...existing };
  players.forEach((id, index) => {
    if (typeof base[id] !== "number") {
      base[id] = index;
    }
  });
  return base;
}

/**
 * 決定的配札シードからプレイヤーの数字マップを生成する。
 */
export function buildDeterministicNumberMap(
  playerIds: string[],
  seed: string,
  min: number,
  max: number
): Record<string, number | null> {
  const generated = generateDeterministicNumbers(playerIds.length, min, max, seed);
  const map: Record<string, number | null> = {};
  playerIds.forEach((pid, index) => {
    map[pid] = generated[index] ?? null;
  });
  return map;
}

