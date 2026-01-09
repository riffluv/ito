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

