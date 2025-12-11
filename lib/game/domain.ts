import type { RoomDoc, RoomStats } from "@/lib/types";
import { generateDeterministicNumbers } from "@/lib/game/random";
import { applyPlay, evaluateSorted, type OrderState, shouldFinishAfterPlay } from "@/lib/game/rules";
import { applyOutcomeToRoomStats } from "@/lib/game/roomStats";
export {
  applyOutcomeToRoomStats,
  createInitialRoomStats,
  normalizeRoomStats,
} from "@/lib/game/roomStats";

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
  if (lastSeen && typeof (lastSeen as { toMillis?: () => number }).toMillis === "function") {
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

export type ProposalInsertResult = {
  status: "ok" | "noop";
  normalized: (string | null)[];
  finalIndex: number;
  changedSlots: number;
  nullCount: number;
};

/**
 * 提案配列にカードを挿入した結果を計算する純粋関数。
 * - targetIndex=-1 のときは最初の空きスロットに挿入（なければ末尾追加）
 * - targetIndex>=0 のときは指定位置に挿入し、既に埋まっていれば noop
 */
export function prepareProposalInsert(
  current: (string | null | undefined)[],
  playerId: string,
  maxCount: number,
  targetIndex: number
): ProposalInsertResult {
  const existing = Array.isArray(current) ? [...current] : [];
  if (existing.includes(playerId)) {
    const normalized = normalizeProposal(existing, maxCount);
    const { changedSlots, nullCount } = diffProposal(normalized, normalized);
    return {
      status: "noop",
      normalized,
      finalIndex: normalized.indexOf(playerId),
      changedSlots,
      nullCount,
    };
  }

  const next = [...existing];

  if (targetIndex === -1) {
    let placed = false;
    const limit = Math.max(next.length, maxCount);
    for (let i = 0; i < limit; i += 1) {
      if (i >= next.length) next.length = i + 1;
      if (next[i] === null || next[i] === undefined) {
        next[i] = playerId;
        placed = true;
        break;
      }
    }
    if (!placed) next.push(playerId);
  } else {
    const clamped = Math.max(0, Math.min(targetIndex, Math.max(0, maxCount - 1)));
    if (clamped < next.length) {
      if (typeof next[clamped] === "string" && next[clamped]) {
        const normalized = normalizeProposal(next, maxCount);
        const { changedSlots, nullCount } = diffProposal(existing, normalized);
        return {
          status: "noop",
          normalized,
          finalIndex: normalized.indexOf(playerId),
          changedSlots,
          nullCount,
        };
      }
    } else {
      next.length = clamped + 1;
    }
    next[clamped] = playerId;
  }

  if (maxCount > 0 && next.length > maxCount) {
    next.length = maxCount;
  }

  // normalize用に疎な要素を null で埋める（map がスキップしないように）
  for (let i = 0; i < next.length; i += 1) {
    if (next[i] === undefined) next[i] = null;
  }

  const normalized = normalizeProposal(next, maxCount);
  const { changedSlots, nullCount } = diffProposal(existing, normalized);
  return {
    status: "ok",
    normalized,
    finalIndex: normalized.indexOf(playerId),
    changedSlots,
    nullCount,
  };
}

export function diffProposal(
  before: (string | null | undefined)[],
  after: (string | null | undefined)[]
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

// --- Sort-submit validation & helpers ---

export type SubmitListValidationResult =
  | { ok: true; expected: number }
  | { ok: false; error: string };

/**
 * 並び替え提出リストの妥当性をチェックする純粋関数。
 */
export function validateSubmitList(
  list: string[],
  roundPlayers: string[] | null,
  expectedCount: number
): SubmitListValidationResult {
  if (new Set(list).size !== list.length) {
    return { ok: false, error: "提出リストに重複があります" };
  }

  const expected = expectedCount >= 0 ? expectedCount : list.length;
  if (expected >= 2 && list.length !== expected) {
    return {
      ok: false,
      error: `提出数が有効人数(${expected})と一致しません`,
    };
  }

  if (roundPlayers) {
    const allMember = list.every((pid) => roundPlayers.includes(pid));
    if (!allMember) {
      return {
        ok: false,
        error: "提出リストに対象外のプレイヤーが含まれています",
      };
    }
  }

  return { ok: true, expected };
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

export type RevealOutcomePayload = {
  order: {
    list: string[];
    numbers: Record<string, number | null | undefined>;
    total: number;
    failed: boolean;
    failedAt: number | null;
    lastNumber: number | null;
  };
  success: boolean;
  stats: RoomStats;
};

export type PlayOutcomePayload = {
  order: OrderState;
  success: boolean;
  stats: RoomStats;
};

/**
 * 並び替え判定結果から、reveal 用の order/結果/統計を組み立てる純粋関数。
 * Firestore の serverTimestamp など I/O 依存は含めない。
 */
export function buildRevealOutcomePayload(params: {
  list: string[];
  numbers: Record<string, number | null | undefined>;
  expectedTotal: number;
  previousStats?: RoomStats | null;
}): RevealOutcomePayload {
  const { list, numbers, expectedTotal, previousStats } = params;
  const judgment = evaluateSorted(list, numbers);
  const success = judgment.success;
  const stats = applyOutcomeToRoomStats(
    previousStats ?? null,
    success ? "success" : "failure"
  );
  return {
    order: {
      list,
      numbers,
      total: expectedTotal,
      failed: !success,
      failedAt: judgment.failedAt,
      lastNumber: judgment.last ?? null,
    },
    success,
    stats,
  };
}

/**
 * clueフェーズの1枚プレイ結果を構築する純粋関数。
 */
export function buildPlayOutcomePayload(params: {
  currentOrder: OrderState;
  playerId: string;
  myNum: number;
  total: number | null | undefined;
  presenceCount: number | null | undefined;
  allowContinue: boolean;
  previousStats?: RoomStats | null;
  decidedAt?: number | null;
}): { next: OrderState; shouldFinish: boolean; payload?: PlayOutcomePayload } {
  const {
    currentOrder,
    playerId,
    myNum,
    total,
    presenceCount,
    allowContinue,
    previousStats,
    decidedAt,
  } =
    params;
  const { next } = applyPlay({ order: currentOrder, playerId, myNum });
  if (typeof decidedAt === "number" && decidedAt > 0 && !next.decidedAt) {
    next.decidedAt = decidedAt;
  }
  const shouldFinish = shouldFinishAfterPlay({
    nextListLength: next.list.length,
    total,
    presenceCount,
    nextFailed: !!next.failed,
    allowContinue,
  });

  if (!shouldFinish) {
    return { next, shouldFinish: false };
  }

  const success = !next.failed;
  const stats = applyOutcomeToRoomStats(previousStats ?? null, success ? "success" : "failure");
  return {
    next,
    shouldFinish: true,
    payload: { order: next, success, stats },
  };
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
