import type { RoomStats } from "@/lib/types";
import {
  applyPlay,
  evaluateSorted,
  type OrderState,
  shouldFinishAfterPlay,
} from "@/lib/game/rules";
import { applyOutcomeToRoomStats } from "@/lib/game/roomStats";

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
  const stats = applyOutcomeToRoomStats(previousStats ?? null, success ? "success" : "failure");
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
  } = params;
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

