import type { SoundId } from "@/lib/audio/types";
import type { ResolveMode } from "@/lib/game/resolveMode";
import {
  clearSortedRevealCache,
  readSortedRevealCache,
  touchSortedRevealCache,
} from "@/lib/game/resultPrefetch";
import { finalizeReveal } from "@/lib/game/room";
import { evaluateSorted } from "@/lib/game/rules";
import type { RoomDoc } from "@/lib/types";
import {
  FINAL_TWO_BONUS_DELAY,
  FLIP_DURATION_MS,
  FLIP_EVALUATION_DELAY,
  RESULT_INTRO_DELAY,
  RESULT_RECOGNITION_DELAY,
  REVEAL_ACCELERATION_FACTOR,
  REVEAL_FLASH_DURATION,
  REVEAL_FIRST_DELAY,
  REVEAL_INITIAL_STEP_DELAY,
  REVEAL_MIN_STEP_DELAY,
} from "@/lib/ui/motion";
import { logWarn } from "@/lib/utils/log";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

declare global {
  interface Window {
    __ITO_REVEAL_PLAN_LAST_END__?: number | null;
    __ITO_REVEAL_PLAN_LENGTH__?: number | null;
    __ITO_REVEAL_PLAN_BUILT_AT__?: number | null;
  }
}

type FlipPlan = {
  index: number;
  startAt: number;
  endAt: number;
  evalAt: number;
};

type RevealPersistenceDeps = {
  requireDb: typeof import("@/lib/firebase/require").requireDb;
  doc: typeof import("firebase/firestore").doc;
  runTransaction: typeof import("firebase/firestore").runTransaction;
  serverTimestamp: typeof import("firebase/firestore").serverTimestamp;
};

let revealPersistenceDepsPromise: Promise<RevealPersistenceDeps> | null = null;

async function preloadRevealPersistenceDeps(): Promise<RevealPersistenceDeps> {
  if (!revealPersistenceDepsPromise) {
    revealPersistenceDepsPromise = (async () => {
      const [firebaseRequire, firestore] = await Promise.all([
        import("@/lib/firebase/require"),
        import("firebase/firestore"),
      ]);
      return {
        requireDb: firebaseRequire.requireDb,
        doc: firestore.doc,
        runTransaction: firestore.runTransaction,
        serverTimestamp: firestore.serverTimestamp,
      };
    })().catch((error) => {
      revealPersistenceDepsPromise = null;
      throw error;
    });
  }
  return revealPersistenceDepsPromise;
}

type SimpleIdleCallback = (
  callback: () => void,
  options?: { timeout?: number }
) => number;

const scheduleRevealPersistenceTask = (task: () => void) => {
  if (typeof window === "undefined") {
    task();
    return;
  }
  const idle = (window as Window & { requestIdleCallback?: SimpleIdleCallback })
    .requestIdleCallback;
  if (typeof idle === "function") {
    idle(
      () => {
        task();
      },
      { timeout: 1500 }
    );
    return;
  }
  window.setTimeout(task, 0);
};

const scheduleIdleRevealTask = (task: () => void, timeout = 1200) => {
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

interface RealtimeResult {
  success: boolean;
  failedAt: number | null;
  currentIndex: number;
}

interface UseRevealAnimationProps {
  roomId: string;
  roomStatus?: string;
  resolveMode?: ResolveMode | undefined;
  orderListLength: number;
  orderData?: {
    list: string[];
    numbers: Record<string, number | null | undefined>;
  } | null;
  startPending?: boolean;
}

export function useRevealAnimation({
  roomId,
  roomStatus,
  resolveMode,
  orderListLength,
  orderData,
  startPending = false,
}: UseRevealAnimationProps) {
  const [revealAnimating, setRevealAnimating] = useState(false);
  const [revealIndex, setRevealIndex] = useState(0);
  const [realtimeResult, setRealtimeResult] = useState<RealtimeResult | null>(
    null
  );
  const [finalizeScheduled, setFinalizeScheduled] = useState(false);
  const [resultIntroReadyAt, setResultIntroReadyAt] = useState<number | null>(
    null
  );
  const prevStatusRef = useRef(roomStatus);
  const roomStatusRef = useRef(roomStatus);
  const orderListLengthRef = useRef(orderListLength);
  const revealIndexRef = useRef(revealIndex);
  const orderDataRef = useRef(orderData);
  const startSignalRef = useRef<boolean>(false);
  const finalizePendingRef = useRef(false);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFlipEndRef = useRef<number>(0);
  const flipPlanRef = useRef<FlipPlan[]>([]);
  const prewarmStateRef = useRef<{
    ready: boolean;
    promise: Promise<void> | null;
  }>({ ready: false, promise: null });

  useEffect(() => {
    if (resolveMode === "sort-submit" && orderListLength > 0) {
      void preloadRevealPersistenceDeps().catch((error) => {
        logWarn("reveal", "preload-result-modules-failed", error);
      });
    }
  }, [resolveMode, orderListLength]);

  useEffect(() => {
    if (
      resolveMode !== "sort-submit" ||
      !orderData ||
      !Array.isArray(orderData.list) ||
      orderData.list.length === 0 ||
      !orderData.numbers
    ) {
      return;
    }
    touchSortedRevealCache(roomId, orderData.list, orderData.numbers);
  }, [orderData, resolveMode, roomId]);

  const ensureRevealPrewarm = useCallback(() => {
    if (prewarmStateRef.current.ready) {
      return Promise.resolve();
    }
    if (prewarmStateRef.current.promise) {
      return prewarmStateRef.current.promise;
    }
    const prewarmSounds: SoundId[] = [
      "card_flip",
      "clear_success1",
      "clear_failure",
    ];
    const promise = new Promise<void>((resolve) => {
      scheduleIdleRevealTask(() => {
        const tasks: Promise<unknown>[] = [];
        tasks.push(
          import("@/components/ui/ThreeBackground")
            .then(() => {})
            .catch(() => {})
        );
        tasks.push(
          import("@/lib/pixi/victoryRays").then(() => {}).catch(() => {})
        );
        tasks.push(
          import("@/lib/audio/global")
            .then(async ({ getGlobalSoundManager }) => {
              const manager = getGlobalSoundManager();
              if (manager) {
                await manager.prewarm(prewarmSounds);
              }
            })
            .catch(() => {})
        );

        void Promise.allSettled(tasks).then(() => resolve());
      }, 900);
    })
      .then(() => {
        prewarmStateRef.current.ready = true;
      })
      .catch(() => {
        // prewarm failure is non-fatal
      });

    prewarmStateRef.current.promise = promise.finally(() => {
      prewarmStateRef.current.promise = null;
    });
    return prewarmStateRef.current.promise;
  }, []);

  const hasEvaluatedFinalCard = useMemo(() => {
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
  }, [orderData, orderListLength, realtimeResult, resolveMode, revealIndex]);

  const finalizeReady =
    revealAnimating &&
    orderListLength > 0 &&
    revealIndex >= orderListLength &&
    hasEvaluatedFinalCard;

  useEffect(() => {
    if ((startPending || roomStatus === "reveal") && orderListLength > 0) {
      void ensureRevealPrewarm();
    }
  }, [ensureRevealPrewarm, orderListLength, roomStatus, startPending]);

  // 最終カードがめくれたあとに必ず入れる“余韻”時間（人数に依存させず一定）
  // フリップ完了から RESULT_INTRO_DELAY 分だけ待ってから演出・結果表示を解禁する。

  // 画面描画前にリビール開始フラグを立てるため useLayoutEffect を使用。
  // こうすることで roomStatus が "reveal" でも revealAnimating が false のまま描画される
  // 一瞬のフレーム（カードが暗い初期状態で見えてしまう）を防げる。
  useLayoutEffect(() => {
    const prev = prevStatusRef.current;
    const becameReveal = prev !== "reveal" && roomStatus === "reveal";
    const startSignal =
      (!!startPending || roomStatus === "reveal") && orderListLength > 0;
    const startRaised = startSignal && !startSignalRef.current;
    const shouldStart =
      resolveMode === "sort-submit" &&
      orderListLength > 0 &&
      (becameReveal || (startRaised && !revealAnimating));

    if (shouldStart) {
      setRevealAnimating(true);
      setRevealIndex(0);
      setRealtimeResult(null); // リセット
      setResultIntroReadyAt(null); // 前回の演出時刻をクリアして新しいラウンドで再計算する
      finalizePendingRef.current = false;
      setFinalizeScheduled(false);
      if (finalizeTimerRef.current) {
        clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = null;
      }
      lastFlipEndRef.current = 0;

      // リビール開始時に背景フラッシュを発火（「せーの！」のインパクト演出）
      traceAction("reveal.flashWhite.start", {
        renderer: window.bg?.getRenderer?.() ?? "unknown",
        durationMs: REVEAL_FLASH_DURATION,
      });
      try {
        window.bg?.flashWhite?.(REVEAL_FLASH_DURATION);
      } catch (error) {
        traceError("reveal.flashWhite.error", error);
      }
    }
    startSignalRef.current = startSignal;
    prevStatusRef.current = roomStatus;
  }, [roomStatus, resolveMode, orderListLength, revealAnimating, startPending]);

  useEffect(() => {
    roomStatusRef.current = roomStatus;
  }, [roomStatus]);

  useEffect(() => {
    orderListLengthRef.current = orderListLength;
  }, [orderListLength]);

  useEffect(() => {
    orderDataRef.current = orderData;
  }, [orderData]);

  useEffect(() => {
    revealIndexRef.current = revealIndex;
  }, [revealIndex]);

  const scheduledTimersRef = useRef<number[]>([]);
  const lastActualFlipAtRef = useRef<number>(0);

  const clearScheduledTimers = () => {
    if (scheduledTimersRef.current.length === 0) return;
    scheduledTimersRef.current.forEach((id) => clearTimeout(id));
    scheduledTimersRef.current = [];
  };

  const runRealtimeEvaluation = useCallback(
    (nextIndex: number) => {
      try {
        const currentOrderData = orderDataRef.current;
        if (
          nextIndex >= 2 &&
          currentOrderData?.list &&
          currentOrderData?.numbers
        ) {
          const currentList = currentOrderData.list.slice(0, nextIndex);
          const cached = readSortedRevealCache(roomId, nextIndex);
          const result =
            cached ?? evaluateSorted(currentList, currentOrderData.numbers);
          if (!cached) {
            touchSortedRevealCache(
              roomId,
              currentOrderData.list,
              currentOrderData.numbers
            );
          }
          if (!result.success && result.failedAt !== null) {
            setRealtimeResult({
              success: false,
              failedAt: result.failedAt,
              currentIndex: nextIndex,
            });
          } else {
            setRealtimeResult({
              success: result.success,
              failedAt: result.failedAt,
              currentIndex: nextIndex,
            });
          }

          // 成功時で最後のカードの場合は成功結果を保存（完全非同期）
          // NOTE(API1本化例外): この直接書き込みは API1本化ポリシーの例外として許容されている。
          // 理由: リビールアニメーション完了直後に result を先行保存することで、
          //       finalizeReveal API の呼び出し前にユーザー体験を向上させる最適化。
          // 安全性: runTransaction + 既存 result チェックにより冪等性を担保。
          //         最終的な確定は finalizeReveal API が行う。
          if (result.success && nextIndex === orderListLengthRef.current) {
            scheduleRevealPersistenceTask(() => {
              void (async () => {
                try {
                  const { requireDb, doc, runTransaction, serverTimestamp } =
                    await preloadRevealPersistenceDeps();
                  const _db = requireDb();
                  const roomRef = doc(_db, "rooms", roomId);
                  await runTransaction(_db, async (tx) => {
                    const currentSnap = await tx.get(roomRef);
                    if (!currentSnap.exists()) return;
                    const currentRoom = currentSnap.data() as RoomDoc;
                    if (currentRoom.result) return; // 既存結果がある場合はスキップ
                    tx.update(roomRef, {
                      result: {
                        success: true,
                        failedAt: null,
                        lastNumber: result.last,
                        revealedAt: serverTimestamp(),
                      },
                    });
                  });
                } catch (e) {
                  logWarn("reveal", "result-save-error", e);
                }
              })();
            });
          }
        }
      } catch (e) {
        logWarn("reveal", "realtime-eval-error", e);
      }
    },
    [roomId]
  );

  const REVEAL_DEBUG_LOG_ENABLED =
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_DEBUG_REVEAL_SCHEDULE === "1";

  const PREWARM_GRACE_MS = 220; // コールドスタートを避けるための短い待機

  /**
   * 加速テンポ方式の buildFlipPlan
   * - 最初は長め (REVEAL_INITIAL_STEP_DELAY) → 徐々に短く (REVEAL_MIN_STEP_DELAY)
   * - 認識時間を確保しつつテンポ良く盛り上がる
   */
  const buildFlipPlan = useCallback(
    (length: number, startAt: number): FlipPlan[] => {
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
    },
    []
  );

  const MIN_REVEAL_GAP_MS = 140; // 最低でもこれだけ間合いを確保して圧縮を防ぐ

  useEffect(() => {
    if (!revealAnimating || finalizeReady) {
      clearScheduledTimers();
      flipPlanRef.current = [];
      if (typeof window !== "undefined") {
        window.__ITO_REVEAL_PLAN_LAST_END__ = null;
        window.__ITO_REVEAL_PLAN_LENGTH__ = null;
        window.__ITO_REVEAL_PLAN_BUILT_AT__ = null;
      }
      return undefined;
    }

    let cancelled = false;
    clearScheduledTimers();
    flipPlanRef.current = [];
    lastActualFlipAtRef.current = 0;

    const scheduleRun = async () => {
      try {
        const prewarmPromise = ensureRevealPrewarm();
        let prewarmCompleted = false;
        await Promise.race([
          prewarmPromise
            .then(() => {
              prewarmCompleted = true;
            })
            .catch((error) => {
              logWarn("reveal", "prewarm-failed", error);
            }),
          new Promise<void>((resolve) => setTimeout(resolve, PREWARM_GRACE_MS)),
        ]);

        if (!prewarmCompleted) {
          await prewarmPromise.catch(() => void 0);
        }

        if (cancelled) return;

        const base = Date.now();
        const plan = buildFlipPlan(orderListLengthRef.current, base);
        flipPlanRef.current = plan;

        if (typeof window !== "undefined") {
          const last = plan[plan.length - 1] ?? null;
          window.__ITO_REVEAL_PLAN_LAST_END__ = last ? last.endAt : null;
          window.__ITO_REVEAL_PLAN_LENGTH__ = orderListLengthRef.current;
          window.__ITO_REVEAL_PLAN_BUILT_AT__ = base;
        }

        if (plan.length > 0) {
          const last = plan[plan.length - 1];
          lastFlipEndRef.current = last.endAt;
          setResultIntroReadyAt(last.endAt + RESULT_INTRO_DELAY);
        }

        const scheduleFlip = (item: FlipPlan) => {
          if (cancelled) return;
          const now = Date.now();
          const sinceLast =
            lastActualFlipAtRef.current > 0
              ? now - lastActualFlipAtRef.current
              : Number.POSITIVE_INFINITY;
          const timeUntilStart = item.startAt - now;
          const guardDelay =
            sinceLast < MIN_REVEAL_GAP_MS ? MIN_REVEAL_GAP_MS - sinceLast : 0;
          const delay = Math.max(timeUntilStart, guardDelay, 0);

          const timer = window.setTimeout(() => {
            if (cancelled) return;

            const actualStart = Date.now();
            const safeEnd = Math.max(
              item.endAt,
              actualStart + FLIP_DURATION_MS
            );
            lastActualFlipAtRef.current = actualStart;
            lastFlipEndRef.current = safeEnd;

            setRevealIndex((i) => (i >= item.index ? i : item.index));

            if (REVEAL_DEBUG_LOG_ENABLED) {
              logWarn("reveal", "schedule-drift", {
                index: item.index,
                plannedStart: item.startAt,
                actualStart,
                driftStartMs: actualStart - item.startAt,
                plannedEnd: item.endAt,
                actualEnd: safeEnd,
                driftEndMs: safeEnd - item.endAt,
                gapFromPrevMs:
                  sinceLast === Number.POSITIVE_INFINITY ? null : sinceLast,
              });
            }

            const evalDelay = Math.max(item.evalAt - Date.now(), 0);
            const evalTimer = window.setTimeout(() => {
              runRealtimeEvaluation(item.index);
            }, evalDelay);
            scheduledTimersRef.current.push(evalTimer);

            const next = flipPlanRef.current[item.index];
            if (next) {
              scheduleFlip(next);
            }
          }, delay);

          scheduledTimersRef.current.push(timer);
        };

        if (plan.length > 0) {
          scheduleFlip(plan[0]);
        }
      } catch (error) {
        logWarn("reveal", "schedule-run-failed", error);
      }
    };

    void scheduleRun();

    return () => {
      cancelled = true;
      clearScheduledTimers();
    };
  }, [
    finalizeReady,
    orderListLength,
    revealAnimating,
    buildFlipPlan,
    ensureRevealPrewarm,
    runRealtimeEvaluation,
    REVEAL_DEBUG_LOG_ENABLED,
  ]);

  useEffect(() => {
    if (!finalizeReady) {
      if (finalizeTimerRef.current) {
        clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = null;
      }
      return undefined;
    }

    finalizePendingRef.current = true;
    setFinalizeScheduled(true);
    clearSortedRevealCache(roomId);

    const attemptFinalize = () => {
      if (!finalizePendingRef.current) return;
      if (roomStatusRef.current === "reveal") {
        finalizePendingRef.current = false;
        finalizeReveal(roomId).catch(() => void 0);
      }
    };

    const now = Date.now();

    // 最終カードのフリップ完了時刻を計算。
    // lastFlipEndRef はフリップ開始時に更新されるため、この時点では正しい値が入っているはず。
    // ただし、評価完了（hasEvaluatedFinalCard）が先に来た場合や、
    // lastFlipEndRef が未設定（0）または既に過去の場合は、
    // 「今からフリップが始まる」と仮定して最低限の余韻を確保する。
    let safeFlipEnd = lastFlipEndRef.current;

    // lastFlipEndRef が 0（未設定）または既に過去の場合のみ補正
    // 「今より未来」であれば、それは正しい最終フリップ終了時刻
    if (safeFlipEnd <= now) {
      // 最低限「今 + フリップ時間」を確保
      safeFlipEnd = now + FLIP_DURATION_MS;
    }

    // 最終カードのフリップ完了から一定時間（RESULT_INTRO_DELAY）だけ待ってから演出を解禁する。
    const targetIntroAt = safeFlipEnd + RESULT_INTRO_DELAY;
    const finalizeDelay =
      Math.max(targetIntroAt - now, 0) + RESULT_RECOGNITION_DELAY;

    setResultIntroReadyAt((prev) => (prev === null ? targetIntroAt : prev));

    finalizeTimerRef.current = setTimeout(() => {
      finalizeTimerRef.current = null;
      attemptFinalize();
    }, finalizeDelay);

    return () => {
      if (finalizeTimerRef.current) {
        clearTimeout(finalizeTimerRef.current);
        finalizeTimerRef.current = null;
      }
    };
  }, [finalizeReady, orderListLength, revealIndex, roomId]);

  // サーバーが finished を返したらローカルのアニメフラグを解除
  useEffect(() => {
    if (roomStatus === "finished") {
      setRevealAnimating(false);
      finalizePendingRef.current = false;
      setFinalizeScheduled(false);

      // finished がローカルのフリップ進行より先に届くことがある。
      // 最後のフリップ終点を確実に基準にして、余韻を削られないよう clamp する。
      setResultIntroReadyAt((prev) => {
        if (prev) return prev;
        const now = Date.now();
        const flipEnd = lastFlipEndRef.current;

        // まだめくっていない残り枚数を考慮し、確実に遅らせる
        const remainingCards = Math.max(
          orderListLengthRef.current - revealIndexRef.current,
          0
        );

        // 現在進行中カードの終了時刻（未設定/過去なら「今+フリップ時間」に補正）
        const safeFlipEnd = flipEnd > now ? flipEnd : now + FLIP_DURATION_MS;

        // これから先に必要な「めくり間隔」の合計を見積もる（加速テンポの平均値で概算）
        const avgStepDelay = Math.round(
          (REVEAL_INITIAL_STEP_DELAY + REVEAL_MIN_STEP_DELAY) / 2
        );
        const futureIntervals =
          remainingCards <= 0
            ? 0
            : remainingCards * avgStepDelay +
              Math.min(remainingCards, 2) * FINAL_TWO_BONUS_DELAY;

        // フリップ完了＋今後の間合い＋導入余韻
        return safeFlipEnd + futureIntervals + RESULT_INTRO_DELAY;
      });
      // リアルタイム結果は保持する（最終表示で使用するため）
    } else if (roomStatus === "reveal") {
      if (finalizePendingRef.current) {
        finalizePendingRef.current = false;
        finalizeReveal(roomId).catch(() => void 0);
      }
    } else {
      setFinalizeScheduled(false);
    }
  }, [roomStatus, roomId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const event = new CustomEvent("ito:reveal-animating", {
        detail: { roomId, animating: revealAnimating },
      });
      window.dispatchEvent(event);
    } catch {
      /* 無視 */
    }
  }, [revealAnimating, roomId]);

  useEffect(() => {
    return () => {
      clearSortedRevealCache(roomId);
    };
  }, [roomId]);

  return {
    revealAnimating,
    revealIndex,
    realtimeResult,
    finalizeScheduled,
    resultIntroReadyAt,
  } as const;
}
