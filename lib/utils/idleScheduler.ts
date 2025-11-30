"use client";

type IdleDeadline = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleSchedulerOptions = {
  /**
   * requestIdleCallback に渡す timeout。未指定なら 120ms。
   */
  timeoutMs?: number;
  /**
   * requestIdleCallback が無い環境での setTimeout 遅延。未指定なら 24ms。
   */
  delayMs?: number;
};

/**
 * 軽量な idle 実行ユーティリティ。
 * - requestIdleCallback があればそれを使用
 * - 無ければ短い setTimeout にフォールバック
 * - 返り値の cancel を呼ぶと pending 実行をキャンセル
 */
export function scheduleIdleTask(
  task: () => void,
  options?: IdleSchedulerOptions
): () => void {
  const timeoutMs = options?.timeoutMs ?? 120;
  const delayMs = options?.delayMs ?? 24;

  // SSR 環境では即時実行
  if (typeof window === "undefined") {
    task();
    return () => {};
  }

  const idleWin = window as Window & {
    requestIdleCallback?: (cb: (deadline: IdleDeadline) => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  let cancelled = false;
  let idleHandle: number | null = null;
  let timeoutHandle: number | null = null;

  const run = () => {
    if (cancelled) return;
    task();
  };

  if (typeof idleWin.requestIdleCallback === "function") {
    idleHandle = idleWin.requestIdleCallback(
      () => run(),
      { timeout: timeoutMs }
    );
  } else {
    timeoutHandle = window.setTimeout(run, delayMs);
  }

  return () => {
    cancelled = true;
    if (idleHandle !== null) {
      idleWin.cancelIdleCallback?.(idleHandle);
      idleHandle = null;
    }
    if (timeoutHandle !== null) {
      window.clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  };
}
