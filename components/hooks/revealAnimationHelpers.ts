import type { ResolveMode } from "@/lib/game/resolveMode";
import {
  FINAL_TWO_BONUS_DELAY,
  FLIP_DURATION_MS,
  FLIP_EVALUATION_DELAY,
  REVEAL_ACCELERATION_FACTOR,
  REVEAL_FIRST_DELAY,
  REVEAL_INITIAL_STEP_DELAY,
  REVEAL_MIN_STEP_DELAY,
} from "@/lib/ui/motion";

export type FlipPlan = {
  index: number;
  startAt: number;
  endAt: number;
  evalAt: number;
};

export interface RealtimeResult {
  success: boolean;
  failedAt: number | null;
  currentIndex: number;
}

type SimpleIdleCallback = (
  callback: () => void,
  options?: { timeout?: number }
) => number;

export const scheduleIdleRevealTask = (task: () => void, timeout = 1200) => {
  if (typeof window === "undefined") {
    task();
    return;
  }
  const idle = (window as Window & { requestIdleCallback?: SimpleIdleCallback })
    .requestIdleCallback;
  if (typeof idle === "function") {
    idle(task, { timeout });
    return;
  }
  window.setTimeout(task, 16);
};

export function buildFlipPlan(length: number, startAt: number): FlipPlan[] {
  const plan: FlipPlan[] = [];
  let cursor = startAt + REVEAL_FIRST_DELAY;
  let currentStepDelay = REVEAL_INITIAL_STEP_DELAY;

  for (let idx = 0; idx < length; idx += 1) {
    const nextIndex = idx + 1;
    const remainingAfterNext = length - nextIndex;

    // 最後の2枚にはボーナス遅延を追加（ピークエンド効果）
    const bonus =
      remainingAfterNext > 0 && remainingAfterNext <= 2
        ? FINAL_TWO_BONUS_DELAY
        : 0;

    plan.push({
      index: nextIndex,
      startAt: cursor,
      endAt: cursor + FLIP_DURATION_MS,
      evalAt: cursor + FLIP_EVALUATION_DELAY,
    });

    // 次のカードへの間隔を計算（加速係数を適用）
    cursor += currentStepDelay + bonus;

    // 間隔を徐々に短くする（最小値は下回らない）
    currentStepDelay = Math.max(
      REVEAL_MIN_STEP_DELAY,
      Math.round(currentStepDelay * REVEAL_ACCELERATION_FACTOR)
    );
  }
  return plan;
}

type HasEvaluatedFinalCardParams = {
  resolveMode?: ResolveMode | undefined;
  orderListLength: number;
  revealIndex: number;
  orderData?: {
    list: string[];
    numbers: Record<string, number | null | undefined>;
  } | null;
  realtimeResult: RealtimeResult | null;
};

export function computeHasEvaluatedFinalCard({
  resolveMode,
  orderListLength,
  revealIndex,
  orderData,
  realtimeResult,
}: HasEvaluatedFinalCardParams) {
  if (resolveMode !== "sort-submit") {
    return true;
  }
  if (orderListLength <= 0) {
    return false;
  }
  const reachedEndByRevealIndex = revealIndex >= orderListLength;
  // orderData が無い場合は index だけで判断
  if (!orderData) {
    return reachedEndByRevealIndex;
  }
  // 1人（1枚）の場合は評価不要（常に成功）なので、index だけで判断
  if (orderListLength === 1) {
    return reachedEndByRevealIndex;
  }

  // ここからリアルタイム評価結果を参照
  if (!realtimeResult) {
    return false;
  }

  const { success, failedAt, currentIndex } = realtimeResult;

  // 失敗が確定している場合:
  // ・昇順チェック時にどこかで降順が見つかった（failedAt が number）
  //   → その時点の currentIndex まで評価済みとみなし、最後のカードまで
  //      めくり切れば finalize してよい
  // ・全員の数字が埋まっていないなどで success=false かつ failedAt=null の場合は
  //   evaluateSorted の不整合扱いとし、「未評価」とみなして待つ
  if (success === false) {
    if (typeof failedAt === "number") {
      return currentIndex >= orderListLength;
    }
    return false;
  }

  // 成功継続中(success=true)は、currentIndex が最後に到達したときのみ
  // 「最終カードまで評価済み」とみなす。
  return currentIndex >= orderListLength;
}

