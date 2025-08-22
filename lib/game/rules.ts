// ゲーム進行用の純粋ロジック

export type OrderState = {
  list: string[];
  lastNumber: number | null;
  failed: boolean;
  failedAt: number | null;
  decidedAt?: any;
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

export function applyPlay({
  order,
  playerId,
  myNum,
  allowContinue,
}: {
  order: OrderState;
  playerId: string;
  myNum: number;
  allowContinue: boolean;
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
  const violation = !alreadyFailed && order.lastNumber !== null && myNum < order.lastNumber;
  if (violation) {
    if (allowContinue) {
      next.failed = true;
      next.failedAt = next.list.length;
    } else {
      next.failed = true;
      next.failedAt = next.list.length;
    }
  }
  return { next, violation };
}

// 並べ替え一括判定の純関数
// list の順に numbers[id] を参照し、昇順であるかを判定
export function evaluateSorted(
  list: string[],
  numbers: Record<string, number | null | undefined>
): { success: boolean; failedAt: number | null; last: number | null } {
  let last: number | null = null
  for (let i = 0; i < list.length; i++) {
    const id = list[i]
    const n = numbers[id]
    if (typeof n !== "number") return { success: false, failedAt: i + 1, last }
    if (last !== null && n < last) return { success: false, failedAt: i + 1, last: n }
    last = n
  }
  return { success: true, failedAt: null, last }
}
