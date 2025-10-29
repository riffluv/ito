import type { PlayerDoc } from "@/lib/types";

type PresenceArgs = {
  baseIds: readonly string[];
  onlineUids?: readonly string[] | null;
  presenceReady: boolean;
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
}: PresenceArgs): string[] {
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

  return filtered;
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
  status: any;
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
 * スロット数を決定する純粋関数。進行中はオンライン在室数を優先。
 */
export function computeSlotCount(opts: {
  status: any;
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
      return Math.max(propLen, onlineCount);
    }
  }

  return Math.max(propLen, dealLen, opts.playersCount);
}

/**
 * 表示系の共通判定: リビール中かどうか。
 * 将来的にローカル/共有ゲートを併合するための小さなセレクタ。
 */
export function isRevealing(opts: { status: any; localHide?: boolean; uiRevealPending?: boolean }): boolean {
  return opts.status === "reveal" || !!opts.localHide || !!opts.uiRevealPending;
}
