import { SEQ_FIRST_CLUE_MS, SEQ_FLIP_INTERVAL_MS } from "@/lib/ui/motion";
import { useEffect, useRef } from "react";
import { useTimerManager } from "./useTimerManager";
import { useFlipState } from "./useFlipState";
import { 
  calculateFlipDelay, 
  calculateBatchDelay, 
  getNewlyAddedIds, 
  truncateIds 
} from "@/lib/cards/timing";

interface UseSequentialRevealParams {
  orderListLength: number; // fallback for count-based logic
  placedIds?: string[]; // 順次モードで場に「見えている」と感じる順序付きIDリスト (orderList + pending)
  roomStatus?: string;
  resolveMode?: string;
  enabled?: boolean; // allow feature flag
  firstDelayMs?: number;
  flipDelayMs?: number; // delay before flipping each newly added card
}

// Provides a lightweight reveal index for sequential mode so that newly
// placed cards can first show their clue, then flip to show the number.
export function useSequentialReveal({
  orderListLength,
  placedIds,
  roomStatus,
  resolveMode,
  enabled = true,
  firstDelayMs = SEQ_FIRST_CLUE_MS,
  flipDelayMs = SEQ_FLIP_INTERVAL_MS,
}: UseSequentialRevealParams) {
  // 分離されたhooksを使用
  const { flippedIds, revealIndex, animating, setAnimating, addFlippedId, resetFlipState, setFullFlip, updateRevealIndex, setRevealIndex } = useFlipState();
  const { addTimer, clearAndReset, clearAllTimers } = useTimerManager();
  
  // 残りのref群
  const prevLenRef = useRef(0); // 前回確定した count 基準
  const lastStatusRef = useRef<string | undefined>(roomStatus);
  const seenIdsRef = useRef<string[]>(placedIds || []); // 直近の placedIds（順序）

  useEffect(() => {
    if (!enabled) return;
    if (resolveMode === "sort-submit") return; // only sequential usage
    const prevStatus = lastStatusRef.current;
    const statusChanged = prevStatus !== roomStatus;
    lastStatusRef.current = roomStatus;

    const prev = prevLenRef.current;
    const cur = orderListLength;
    const currentPlaced = placedIds || [];
    const prevPlaced = seenIdsRef.current;

    // ラウンド開始 (waiting->clue 等) で強制リセット
    if (statusChanged && roomStatus === "clue") {
      // どんな残骸でもクリア
      clearAndReset();
      prevLenRef.current = 0;
      seenIdsRef.current = currentPlaced;
      resetFlipState();
    }

    // 途中でカードが減るケース（理論上稀）もリセット
    if (cur < prev) {
      // 何らかのロールバック: フリップ情報を縮退
      clearAndReset();
      const truncated = truncateIds(currentPlaced, flippedIds.size);
      setFullFlip(truncated);
      prevLenRef.current = cur;
      seenIdsRef.current = currentPlaced;
      return;
    }

    // 追加分をスケジュール: 成功で status が 'reveal' に一気に遷移したケースでも
    // アニメ（clue→flip）の猶予を確保したいので 'reveal' も許容する。
    // （failure で 'finished' になった場合は即時フリップ継続で良い想定）
    if (cur > prev && (roomStatus === "clue" || roomStatus === "reveal")) {
      // 追加された ID 群を特定（末尾のみ想定）
      const newIds = getNewlyAddedIds(currentPlaced, prevPlaced);
      if (newIds.length > 0) {
        setAnimating(true);
        let scheduledCount = 0; // 実際にスケジュールされた数をカウント
        
        newIds.forEach((id, i) => {
          // タイミング計算: 非累積方式
          const delay = calculateFlipDelay({
            flippedCount: 0, // 各バッチ内では0から始める
            cardIndex: i,
            firstDelayMs,
            flipDelayMs,
          });
          
          const t = window.setTimeout(() => {
            addFlippedId(id);
            scheduledCount++;
            // revealIndex は flippedIds のサイズで自動更新されるので不要
            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.debug("[seqReveal] flip id", { id, delay, currentFlipped: flippedIds.size + scheduledCount });
            }
          }, delay);
          addTimer(t as unknown as number);
        });
        
        // アニメ終了判定: 最大遅延 + 安全マージン
        const totalDelay = calculateBatchDelay({
          newCardCount: newIds.length,
          flippedCount: 0, // 非累積方式に合わせる
          firstDelayMs,
          flipDelayMs,
        });
        const endT = window.setTimeout(() => {
          setAnimating(false);
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug("[seqReveal] batch complete", { newIds });
          }
        }, totalDelay);
        addTimer(endT as unknown as number);
      }
      prevLenRef.current = cur;
      seenIdsRef.current = currentPlaced;
    }
    
    // 'finished' 到達時の処理: 失敗時でも新しく追加されたカードのアニメーションを確保
    if (roomStatus === "finished") {
      prevLenRef.current = cur;
      seenIdsRef.current = currentPlaced;
      
      // 新しく追加されたカードがある場合は、既存タイマーをクリアして最低表示時間を確保
      const hasNewCards = cur > prev;
      if (hasNewCards) {
        // 競合を避けるため、既存のタイマーのみをクリア（flippedIds状態は保持）
        clearAllTimers();
        // 新カードがある場合は、最低限の表示時間後に全フリップ
        const minDisplayTime = firstDelayMs - 200; // やや短めに調整
        const timer = window.setTimeout(() => {
          setFullFlip(currentPlaced);
        }, minDisplayTime);
        addTimer(timer as unknown as number);
      } else if (!animating) {
        // 新カードが無く、アニメーション中でない場合のみ即座に設定
        setFullFlip(currentPlaced);
      }
      // アニメーション中の場合は自然に完了を待つ
    }

    return () => {
      // クリーンアップ（依存変化時のみ）
    };
  }, [
    orderListLength,
    roomStatus,
    resolveMode,
    enabled,
    firstDelayMs,
    flipDelayMs,
    flippedIds.size,
    animating,
    placedIds?.join(","),
    addFlippedId,
    setRevealIndex,
    setAnimating,
    resetFlipState,
    setFullFlip,
    addTimer,
    clearAndReset,
    clearAllTimers,
  ]);

  // Keep prevLenRef updated separately to avoid race conditions
  useEffect(() => {
    prevLenRef.current = orderListLength;
  }, [orderListLength]);

  // flippedIds 変更時に revealIndex を同期（冪等安全）
  useEffect(() => {
    setRevealIndex(flippedIds.size);
  }, [flippedIds.size, setRevealIndex]);

  return { revealIndex, revealAnimating: animating, flippedIds };
}

export default useSequentialReveal;
