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
  REVEAL_FIRST_DELAY,
  REVEAL_STEP_DELAY,
} from "@/lib/ui/motion";
import { logWarn } from "@/lib/utils/log";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

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
  const startSignalRef = useRef<boolean>(false);
  const finalizePendingRef = useRef(false);
  const finalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    // orderData が無い場合は index だけで判断
    if (!orderData) {
      return reachedEndByRevealIndex;
    }
    // 1人（1枚）の場合は評価不要（常に成功）なので、index だけで判断
    if (orderListLength === 1) {
      return reachedEndByRevealIndex;
    }
    // 評価結果がまだなら「未評価」とみなし、finalize を遅らせる
    if (!realtimeResult) {
      return false;
    }
    if (realtimeResult.success === false) {
      return true;
    }
    return realtimeResult.currentIndex >= orderListLength;
  }, [orderData, orderListLength, realtimeResult, resolveMode, revealIndex]);

  const finalizeReady =
    revealAnimating &&
    orderListLength > 0 &&
    revealIndex >= orderListLength &&
    hasEvaluatedFinalCard;

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
    revealIndexRef.current = revealIndex;
  }, [revealIndex]);

  // リビールアニメの進行を管理
  useEffect(() => {
    if (!revealAnimating || finalizeReady) {
      return undefined;
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
          logWarn("reveal", "realtime-eval-error", e);
        }
      };
    setTimeout(handleRealtimeEvaluation, FLIP_EVALUATION_DELAY); // 視覚上のフリップ完了と評価処理を同期
  }, delay);

    return () => clearTimeout(timer);
  }, [
    finalizeReady,
    orderData,
    orderListLength,
    revealAnimating,
    revealIndex,
    roomId,
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

        // これから先に必要な「めくり間隔」の合計を見積もる
        const futureIntervals =
          remainingCards <= 0
            ? 0
            : remainingCards * REVEAL_STEP_DELAY +
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
