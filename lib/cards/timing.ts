/**
 * カードアニメーション関連のタイミング計算とユーティリティ関数
 * CentralCardBoard.tsxから抽出した純粋関数群
 */

export interface DelayCalculationParams {
  flippedCount: number;
  cardIndex: number;
  firstDelayMs: number;
  flipDelayMs: number;
}

/**
 * 順次モードでのカードフリップ遅延時間を計算（累積遅延）
 * @param params 計算に必要なパラメータ
 * @returns 遅延時間（ms）
 */
export function calculateFlipDelay({
  flippedCount,
  cardIndex,
  firstDelayMs,
  flipDelayMs,
}: DelayCalculationParams): number {
  const globalIndex = flippedCount + cardIndex;
  if (globalIndex === 0) {
    // 1枚目: 初回遅延
    return firstDelayMs;
  } else {
    // 2枚目以降: 前のカードからのインターバル
    // 累積遅延ではなく、各カード間の固定間隔
    return firstDelayMs + (flipDelayMs * cardIndex);
  }
}

export interface BatchDelayParams {
  newCardCount: number;
  flippedCount: number;
  firstDelayMs: number;
  flipDelayMs: number;
}

/**
 * 一括アニメーション終了時間を計算
 * @param params 計算に必要なパラメータ
 * @returns 総遅延時間（ms）
 */
export function calculateBatchDelay({
  newCardCount,
  flippedCount,
  firstDelayMs,
  flipDelayMs,
}: BatchDelayParams): number {
  const maxDelay = Math.max(
    ...Array.from({ length: newCardCount }, (_, i) => {
      return calculateFlipDelay({
        flippedCount: 0, // 非累積方式に合わせる
        cardIndex: i,
        firstDelayMs,
        flipDelayMs,
      });
    })
  );
  return maxDelay + 150; // 安全マージンを少し増加
}

/**
 * 順次モードで新しく追加されたカードIDsを特定
 * @param currentIds 現在のID配列
 * @param previousIds 前回のID配列
 * @returns 新しく追加されたID配列
 */
export function getNewlyAddedIds(
  currentIds: string[],
  previousIds: string[]
): string[] {
  return currentIds.slice(previousIds.length);
}

/**
 * IDリストの縮退（ロールバック時の安全な切り捨て）
 * @param currentIds 現在のID配列
 * @param maxLength 最大許可長
 * @returns 切り捨てられたID配列
 */
export function truncateIds(currentIds: string[], maxLength: number): string[] {
  return currentIds.slice(0, maxLength);
}