import type { RoomDoc } from "@/lib/types";
import { normalizeIdArray } from "@/lib/game/selectors/normalizeIds";

type RoomStatus = RoomDoc["status"];

function isHistoryStatus(status: RoomStatus | undefined): boolean {
  return status === "reveal" || status === "finished";
}

function filterEligibleIds(
  values: readonly (string | null)[],
  eligible: ReadonlySet<string>
): string[] {
  return values.filter(
    (id): id is string => typeof id === "string" && eligible.has(id)
  );
}

function countNonEmptyStrings(values: readonly (string | null)[]): number {
  return values.filter((value): value is string => typeof value === "string").length;
}

function countOnlinePlayers(opts: {
  onlineUids: readonly string[];
  playerIds?: readonly string[] | null;
}): number {
  if (Array.isArray(opts.playerIds) && opts.playerIds.length > 0) {
    const allowed = new Set(opts.playerIds);
    return opts.onlineUids.filter((uid) => allowed.has(uid)).length;
  }
  return opts.onlineUids.length;
}

/**
 * 進行中は在室メンバーのみを反映し、reveal/finished は履歴をそのまま表示。
 * UIとロジックの一貫性向上のための純粋関数。
 */
export function computeVisibleProposal(opts: {
  status: RoomStatus | undefined;
  orderList?: readonly string[] | null;
  proposal?: readonly (string | null)[] | readonly string[] | null;
  eligibleIds?: readonly string[] | null; // 進行中のみ適用
}): (string | null)[] {
  const status = opts.status;
  const normalizedOrder = normalizeIdArray(opts.orderList || []);
  if (isHistoryStatus(status)) {
    return normalizedOrder;
  }
  const eligible = new Set<string>(opts.eligibleIds || []);
  const normalizedProposal = normalizeIdArray(opts.proposal || []);
  const filteredProposal = filterEligibleIds(normalizedProposal, eligible);
  if (filteredProposal.length > 0) return filteredProposal;
  const filteredOrder = filterEligibleIds(normalizedOrder, eligible);
  if (filteredOrder.length > 0) return filteredOrder;
  return [];
}

/**
 * CentralCardBoard 用: proposal を「スロット配列」として表示するための純粋関数。
 * - waiting は常に空（RESET直後に古い proposal が見えてチラつくのを防ぐ）
 * - reveal/finished は order.list（履歴）をそのまま返す
 * - clue 中は eligible だけ残し、proposal のスロット位置は維持する
 * - proposal が空なら order.list へフォールバック（eligible のみに限定して返す）
 */
export function computeBoardActiveProposal(opts: {
  status: RoomStatus | undefined;
  orderList?: readonly string[] | null;
  proposal?: readonly (string | null)[] | readonly string[] | null;
  eligibleIdSet: ReadonlySet<string>;
  orderListKey?: string | null;
  proposalKey?: string | null;
}): (string | null)[] {
  const status = opts.status;

  if (status === "waiting") {
    return [];
  }

  const hasAnySnapshot =
    typeof opts.orderListKey === "string" || typeof opts.proposalKey === "string"
      ? Boolean(opts.orderListKey) || Boolean(opts.proposalKey)
      : (Array.isArray(opts.orderList) && opts.orderList.length > 0) ||
        (Array.isArray(opts.proposal) && opts.proposal.length > 0);

  if (!hasAnySnapshot) {
    return [];
  }

  const normalizedOrder = normalizeIdArray(opts.orderList || []);

  if (isHistoryStatus(status)) {
    return normalizedOrder;
  }

  const eligible = opts.eligibleIdSet;

  if (Array.isArray(opts.proposal)) {
    const normalizedProposal = normalizeIdArray(opts.proposal);
    const sanitized = normalizedProposal.map((id) =>
      typeof id === "string" && eligible.has(id) ? id : null
    );
    if (sanitized.some(Boolean)) {
      return sanitized;
    }
  }

  if (normalizedOrder.some(Boolean)) {
    const filteredOrder = filterEligibleIds(normalizedOrder, eligible);
    if (filteredOrder.length > 0) {
      return filteredOrder;
    }
  }

  return [];
}

export function collectServerAssignedSeatIds(opts: {
  dealPlayers?: unknown;
  orderList?: unknown;
  proposal?: unknown;
}): Set<string> {
  const assigned = new Set<string>();

  const pushList = (list: unknown) => {
    for (const value of normalizeIdArray(list)) {
      if (typeof value === "string") {
        assigned.add(value);
      }
    }
  };

  pushList(opts.dealPlayers);
  pushList(opts.orderList);
  pushList(opts.proposal);
  return assigned;
}

/**
 * スロット数を決定する純粋関数。進行中はオンライン在室数を優先。
 */
export function computeSlotCount(opts: {
  status: RoomStatus | undefined;
  orderList?: readonly string[] | null;
  dealPlayers?: readonly string[] | null;
  proposal?: readonly (string | null)[] | readonly string[] | null;
  presenceReady: boolean;
  onlineUids?: readonly string[] | null;
  playersCount: number;
  playerIds?: readonly string[] | null;
}): number {
  const status = opts.status;
  if (isHistoryStatus(status)) {
    return Array.isArray(opts.orderList) ? opts.orderList.length : 0;
  }
  const propLen = Array.isArray(opts.proposal)
    ? countNonEmptyStrings(opts.proposal as readonly (string | null)[])
    : 0;
  const dealLen = Array.isArray(opts.dealPlayers) ? opts.dealPlayers.length : 0;

  if (opts.presenceReady && Array.isArray(opts.onlineUids)) {
    const onlineCount = countOnlinePlayers({
      onlineUids: opts.onlineUids,
      playerIds: opts.playerIds,
    });
    if (onlineCount > 0) {
      return Math.max(propLen, dealLen, onlineCount, opts.playersCount);
    }
  }

  return Math.max(propLen, dealLen, opts.playersCount);
}
