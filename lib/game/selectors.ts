import type { PlayerDoc, RoomDoc } from "@/lib/types";

type RoomStatus = RoomDoc["status"];

type PresenceArgs = {
  baseIds: readonly string[];
  onlineUids?: readonly string[] | null;
  presenceReady: boolean;
  /**
   * presence が未準備かつ onlineUids が空のときに eligibleIds を空にしてブロックするか。
   * 既定 true（START/DEAL ガード目的）。
   * UI 表示などでフォールバックしたい場合は false を渡す。
   */
  blockWhenNotReadyEmpty?: boolean;
};

type ClueTargetArgs = {
  dealPlayers?: readonly unknown[] | null;
  eligibleIds: readonly string[];
};

type ClueReadyArgs = {
  players: ReadonlyArray<(PlayerDoc & { id: string }) | { id: string; ready?: boolean }>;
  targetIds: readonly string[];
};

export function getPresenceEligibleIds({
  baseIds,
  onlineUids,
  presenceReady,
  blockWhenNotReadyEmpty = true,
}: PresenceArgs): string[] {
  // presenceReady が立っておらず、オンライン情報も空なら開始をブロック
  if (
    blockWhenNotReadyEmpty &&
    !presenceReady &&
    (!Array.isArray(onlineUids) || onlineUids.length === 0)
  ) {
    return [];
  }
  if (!presenceReady) {
    return [...baseIds];
  }
  if (!Array.isArray(onlineUids) || onlineUids.length === 0) {
    return [...baseIds];
  }

  const onlineSet = new Set(onlineUids);
  const filtered = baseIds.filter((id) => onlineSet.has(id));

  if (filtered.length === 0) {
    return [...baseIds];
  }

  if (filtered.length === baseIds.length) {
    return filtered;
  }

  const missing = baseIds.filter((id) => !onlineSet.has(id));
  return [...filtered, ...missing];
}

export function getClueTargetIds({
  dealPlayers,
  eligibleIds,
}: ClueTargetArgs): string[] {
  if (Array.isArray(dealPlayers)) {
    const filtered = dealPlayers.filter(
      (pid): pid is string => typeof pid === "string" && pid.length > 0
    );

    if (filtered.length > 0) {
      return filtered;
    }
  }

  return [...eligibleIds];
}

export function areAllCluesReady({
  players,
  targetIds,
}: ClueReadyArgs): boolean {
  if (!Array.isArray(targetIds) || targetIds.length === 0) {
    return false;
  }

  const idSet = new Set(targetIds);
  const targets = players.filter((player) => idSet.has(player.id));

  return targets.length > 0 && targets.every((player) => player.ready === true);
}

export function prioritizeHostId(opts: {
  eligibleIds: string[];
  hostId?: string | null;
}): string[] {
  const hostId = typeof opts.hostId === "string" ? opts.hostId : "";
  const eligibleIds = opts.eligibleIds;
  if (!hostId) return eligibleIds;
  if (eligibleIds.length === 0) return eligibleIds;
  if (eligibleIds[0] === hostId) return eligibleIds;
  if (!eligibleIds.includes(hostId)) return eligibleIds;
  return [hostId, ...eligibleIds.filter((id) => id !== hostId)];
}

// 正規化ヘルパー
const normalizeIdArray = (arr: unknown): (string | null)[] =>
  Array.isArray(arr)
    ? (arr as unknown[]).map((v) =>
        typeof v === "string" && v.trim().length > 0 ? v : null
      )
    : [];

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
  if (status === "reveal" || status === "finished") {
    return normalizedOrder;
  }
  const eligible = new Set<string>(opts.eligibleIds || []);
  const normalizedProposal = normalizeIdArray(opts.proposal || []);
  const filteredProposal = normalizedProposal.filter(
    (id): id is string => typeof id === "string" && eligible.has(id)
  );
  if (filteredProposal.length > 0) return filteredProposal;
  const filteredOrder = normalizedOrder.filter(
    (id): id is string => typeof id === "string" && eligible.has(id)
  );
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

  if (status === "reveal" || status === "finished") {
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
    const filteredOrder = normalizedOrder.filter(
      (id): id is string => typeof id === "string" && eligible.has(id)
    );
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
  if (status === "reveal" || status === "finished") {
    return Array.isArray(opts.orderList) ? opts.orderList.length : 0;
  }
  const propLen = Array.isArray(opts.proposal)
    ? (opts.proposal as readonly (string | null)[]).filter(
        (v): v is string => typeof v === "string"
      ).length
    : 0;
  const dealLen = Array.isArray(opts.dealPlayers) ? opts.dealPlayers.length : 0;

  if (opts.presenceReady && Array.isArray(opts.onlineUids)) {
    const onlineCount = (() => {
      if (Array.isArray(opts.playerIds) && opts.playerIds.length > 0) {
        const allowed = new Set(opts.playerIds);
        return opts.onlineUids.filter((uid) => allowed.has(uid)).length;
      }
      return opts.onlineUids.length;
    })();
    if (onlineCount > 0) {
      return Math.max(propLen, dealLen, onlineCount, opts.playersCount);
    }
  }

  return Math.max(propLen, dealLen, opts.playersCount);
}

/**
 * 表示系の共通判定: リビール中かどうか。
 * 将来的にローカル/共有ゲートを併合するための小さなセレクタ。
 */
export function isRevealing(opts: {
  status: RoomStatus | undefined;
  localHide?: boolean;
  uiRevealPending?: boolean;
}): boolean {
  return opts.status === "reveal" || !!opts.localHide || !!opts.uiRevealPending;
}
