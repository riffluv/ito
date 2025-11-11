// ゲーム進行用の純粋ロジック

/**
 * OrderState represents the current public ordering state of a round.
 * - `list`: player ids in the order they were played
 * - `lastNumber`: last played numeric value
 * - `failed`: whether a violation (non-ascending) occurred
 * - `failedAt`: 1-based index where failure occurred
 */
export type OrderState = {
  list: string[];
  lastNumber: number | null;
  failed: boolean;
  failedAt: number | null;
  decidedAt?: number | Date | null;
  total?: number;
};

export function defaultOrderState(): OrderState {
  return {
    list: [],
    lastNumber: null,
    failed: false,
    failedAt: null,
  };
}

/**
 * applyPlay returns the next OrderState when `playerId` plays `myNum`.
 * It marks `failed`/`failedAt` when a descending number is observed.
 * `allowContinue` is preserved in the signature for historical reasons but
 * currently just results in the same flagging behavior.
 */
export function applyPlay({
  order,
  playerId,
  myNum,
}: {
  order: OrderState;
  playerId: string;
  myNum: number;
}): {
  next: OrderState;
  violation: boolean;
} {
  const alreadyFailed = !!order.failed;
  if (order.list.includes(playerId)) {
    return { next: order, violation: false };
  }
  const next: OrderState = {
    ...order,
    list: [...order.list, playerId],
    lastNumber: myNum,
  };
  const violation =
    !alreadyFailed && order.lastNumber !== null && myNum <= order.lastNumber;
  if (violation) {
    next.failed = true;
    next.failedAt = next.list.length;
  }
  return { next, violation };
}

// 並べ替え一括判定の純関数
// list の順に numbers[id] を参照し、昇順であるかを判定
export function evaluateSorted(
  list: string[],
  numbers: Record<string, number | null | undefined>
): { success: boolean; failedAt: number | null; last: number | null } {
  let last: number | null = null;
  for (let i = 0; i < list.length; i++) {
    const id = list[i];
    const n = numbers[id];
    if (typeof n !== "number") return { success: false, failedAt: i + 1, last };
    // 非厳密昇順（同値OK）。降順のみ失敗とする
    if (last !== null && n < last)
      return { success: false, failedAt: i + 1, last };
    last = n;
  }
  return { success: true, failedAt: null, last };
}

// 決定ロジック: 次の状態で部屋を終了すべきかを判定する純関数
export function shouldFinishAfterPlay({
  nextListLength,
  total,
  presenceCount,
  nextFailed,
  allowContinue,
}: {
  nextListLength: number;
  total: number | null | undefined;
  presenceCount: number | null | undefined;
  nextFailed: boolean;
  allowContinue: boolean;
}): boolean {
  // 方針:
  // - 失敗が発生し、allowContinueAfterFail=false の場合は即終了
  if (nextFailed && !allowContinue) return true;

  // - それ以外は「出し切り」または presence 到達で終了判定
  const totalNum = typeof total === "number" ? total : null;
  // 全員が出し終わっていれば終了
  if (totalNum !== null && nextListLength >= totalNum) return true;

  // presence 情報があり、オンライン人数に到達していれば終了
  if (
    typeof presenceCount === "number" &&
    presenceCount !== null &&
    nextListLength >= presenceCount
  )
    return true;

  // それ以外は継続
  return false;
}
