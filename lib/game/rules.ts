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
