import { finalizeReveal } from "@/lib/game/room";
import { evaluateSorted } from "@/lib/game/rules";
import type { ResolveMode } from "@/lib/game/resolveMode";
import { logDebug, logWarn } from "@/lib/utils/log";
import {
  FLIP_DURATION_MS,
  FLIP_EVALUATION_DELAY,
  FINAL_TWO_BONUS_DELAY,
  REVEAL_FIRST_DELAY,
  REVEAL_STEP_DELAY,
  RESULT_RECOGNITION_DELAY,
} from "@/lib/ui/motion";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { RoomDoc } from "@/lib/types";
import {
  clearSortedRevealCache,
  readSortedRevealCache,
  touchSortedRevealCache,
} from "@/lib/game/resultPrefetch";

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

type SimpleIdleCallback = (callback: () => void, options?: { timeout?: number }) => number;

const scheduleRevealPersistenceTask = (task: () => void) => {
  if (typeof window === "undefined") {
    task();
    return;
  }
  const idle = (window as Window & { requestIdleCallback?: SimpleIdleCallback }).requestIdleCallback;
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
  const prevStatusRef = useRef(roomStatus);
  const startSignalRef = useRef<boolean>(false);
  const finalizePendingRef = useRef(false);
  const lastFlipEndRef = useRef<number>(0);

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

  const hasEvaluatedFinalCard = useMemo(() => {
    if (resolveMode !== "sort-submit") {
      return true;
    }
    if (orderListLength <= 0) {
      return false;
    }
    const reachedEndByRevealIndex = revealIndex >= orderListLength;
    // orderData（numbers）が無い、または realtimeResult が更新されない場合のフォールバック。
    if (!orderData || !realtimeResult) {
      return reachedEndByRevealIndex;
    }
    if (realtimeResult.success === false) {
      return true;
    }
    return realtimeResult.currentIndex >= orderListLength;
  }, [orderData, orderListLength, realtimeResult, resolveMode, revealIndex]);

  // 画面描画前にリビール開始フラグを立てるため useLayoutEffect を使用。
  // こうすることで roomStatus が "reveal" でも revealAnimating が false のまま描画される
  // 一瞬のフレーム（カードが暗い初期状態で見えてしまう）を防げる。
  useLayoutEffect(() => {
    const prev = prevStatusRef.current;
    const becameReveal = prev !== "reveal" && roomStatus === "reveal";
    const startSignal = (!!startPending || roomStatus === "reveal") && orderListLength > 0;
    const startRaised = startSignal && !startSignalRef.current;
    const shouldStart =
      resolveMode === "sort-submit" &&
      orderListLength > 0 &&
      (becameReveal || (startRaised && !revealAnimating));

    if (shouldStart) {
      setRevealAnimating(true);
      setRevealIndex(0);
      setRealtimeResult(null); // リセット
      finalizePendingRef.current = false;
      setFinalizeScheduled(false);
      lastFlipEndRef.current = 0;
      logDebug("reveal", "start", {
        orderListLength,
        reason: becameReveal ? "status" : "pending-signal",
      });
    }
    startSignalRef.current = startSignal;
    prevStatusRef.current = roomStatus;
  }, [roomStatus, resolveMode, orderListLength, revealAnimating, startPending]);

  // リビールアニメの進行を管理
  useEffect(() => {
    if (!revealAnimating) {
      return undefined;
    }

    if (
      revealIndex >= orderListLength &&
      orderListLength > 0 &&
      hasEvaluatedFinalCard
    ) {
      logDebug("reveal", "all-cards-revealed", { revealIndex, orderListLength });
      finalizePendingRef.current = true;
      setFinalizeScheduled(true);
      clearSortedRevealCache(roomId);
      const attemptFinalize = () => {
        if (!finalizePendingRef.current) return;
        if (roomStatus === "reveal") {
          finalizePendingRef.current = false;
          finalizeReveal(roomId).catch(() => void 0);
        }
      };
      const now = Date.now();
      const flipRemainingMs = Math.max(lastFlipEndRef.current - now, 0);
      const finalizeDelay = flipRemainingMs + RESULT_RECOGNITION_DELAY;
      const linger = setTimeout(() => {
        attemptFinalize();
      }, finalizeDelay);
      return () => clearTimeout(linger);
    }

    // 1枚目だけ間を短くして「固まった」印象を避ける
    const remainingCards = Math.max(orderListLength - revealIndex, 0);
    const isFinalStretch = remainingCards > 0 && remainingCards <= 2;
    const delay =
      revealIndex === 0
        ? REVEAL_FIRST_DELAY
        : REVEAL_STEP_DELAY + (isFinalStretch ? FINAL_TWO_BONUS_DELAY : 0);
    
    const timer = setTimeout(async () => {
      const flipStartedAt = Date.now();
      lastFlipEndRef.current = flipStartedAt + FLIP_DURATION_MS;

      // 次にめくる枚数（この時点ではまだ state 更新前）
      const nextIndex = Math.min(revealIndex + 1, orderListLength);

      // インデックスを進める（めくり開始）
      setRevealIndex((i) => (i >= orderListLength ? i : i + 1));

      const handleRealtimeEvaluation = () => {
        try {
          if (nextIndex >= 2 && orderData?.list && orderData?.numbers) {
            const currentList = orderData.list.slice(0, nextIndex);
            const cached = readSortedRevealCache(roomId, nextIndex);
            const result =
              cached ?? evaluateSorted(currentList, orderData.numbers);
            if (!cached) {
              touchSortedRevealCache(roomId, orderData.list, orderData.numbers);
            }
            logDebug("reveal", "step", { nextIndex, result });

            // 失敗 or 成功をめくり完了後にUIへ反映
            if (!result.success && result.failedAt !== null) {
              setRealtimeResult({
                success: false,
                failedAt: result.failedAt,
                currentIndex: nextIndex,
              });
            } else {
              // 成功継続時
              setRealtimeResult({
                success: result.success,
                failedAt: result.failedAt,
                currentIndex: nextIndex,
              });
            }
          

          // 【テスト用】サーバー保存を一時的に無効化
          if (!result.success && result.failedAt !== null) {
            // 失敗検出: サーバー保存を無効化してテスト
          }
          // 成功時で最後のカードの場合は成功結果を保存（完全非同期）
          else if (result.success && nextIndex === orderListLength) {
            // 完全非同期で実行（めくりリズムに影響させない）
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
        logDebug("reveal", "realtime-eval-error", e);
      }
      };
      setTimeout(handleRealtimeEvaluation, FLIP_EVALUATION_DELAY); // 視覚上のフリップ完了と評価処理を同期
    }, delay);

    return () => clearTimeout(timer);
  }, [
    hasEvaluatedFinalCard,
    orderData,
    orderListLength,
    revealAnimating,
    revealIndex,
    roomId,
    roomStatus,
  ]);

  // サーバーが finished を返したらローカルのアニメフラグを解除
  useEffect(() => {
    if (roomStatus === "finished") {
      setRevealAnimating(false);
      finalizePendingRef.current = false;
      setFinalizeScheduled(false);
      // リアルタイム結果は保持する（最終表示で使用するため）
      // 必要ならここで setRealtimeResult(null) を呼ぶ
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
  } as const;
}
