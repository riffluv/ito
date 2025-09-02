import { SEQ_FIRST_CLUE_MS, SEQ_FLIP_INTERVAL_MS } from "@/lib/ui/motion";
import { useEffect, useRef, useState } from "react";

interface UseSequentialRevealParams {
  orderListLength: number;
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
  roomStatus,
  resolveMode,
  enabled = true,
  firstDelayMs = SEQ_FIRST_CLUE_MS,
  flipDelayMs = SEQ_FLIP_INTERVAL_MS,
}: UseSequentialRevealParams) {
  const [revealIndex, setRevealIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const prevLenRef = useRef(0); // 前回確定した長さ
  const timersRef = useRef<number[]>([]);
  const lastStatusRef = useRef<string | undefined>(roomStatus);

  useEffect(() => {
    if (!enabled) return;
    if (resolveMode === "sort-submit") return; // only sequential usage
    const prevStatus = lastStatusRef.current;
    const statusChanged = prevStatus !== roomStatus;
    lastStatusRef.current = roomStatus;

    const prev = prevLenRef.current;
    const cur = orderListLength;

    // ラウンド開始 (waiting->clue 等) で強制リセット
    if (statusChanged && roomStatus === "clue") {
      // どんな残骸でもクリア
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      prevLenRef.current = 0;
      setRevealIndex(0);
      setAnimating(false);
    }

    // 途中でカードが減るケース（理論上稀）もリセット
    if (cur < prev) {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      prevLenRef.current = cur;
      setRevealIndex(cur);
      setAnimating(false);
      return;
    }

    // 追加分をスケジュール: 成功で status が 'reveal' に一気に遷移したケースでも
    // アニメ（clue→flip）の猶予を確保したいので 'reveal' も許容する。
    // （failure で 'finished' になった場合は即時フリップ継続で良い想定）
    if (cur > prev && (roomStatus === "clue" || roomStatus === "reveal")) {
      // revealIndex が prev を超えていたら（HMR 残留）戻す
      setRevealIndex((r) => (r > prev ? prev : r));
      const delta = cur - prev;
      setAnimating(true);
      for (let i = 0; i < delta; i++) {
        const stepTarget = prev + i + 1; // 到達すべき revealIndex
        const delay = firstDelayMs + i * flipDelayMs;
        const t = window.setTimeout(() => {
          setRevealIndex(stepTarget);
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug("[seqReveal] flip increment", {
              i,
              delay,
              stepTarget,
            });
          }
          // 最終到達でアニメ終了
          if (stepTarget === cur) {
            setAnimating(false);
            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.debug("[seqReveal] sequence complete", {
                finalRevealIndex: cur,
              });
            }
          }
        }, delay);
        timersRef.current.push(t as unknown as number);
      }
      prevLenRef.current = cur; // 先に更新し二重スケジュール防止
    }
    // 'reveal' では即強制全開示しない（上の条件でスケジュール済み）。
    // 'finished' 到達時のみ残タスクを全て消化して強制的に最終状態へ。
    if (roomStatus === "finished") {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setRevealIndex(cur);
      setAnimating(false);
      prevLenRef.current = cur;
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
  ]);

  // Keep prevLenRef updated separately to avoid race conditions
  useEffect(() => {
    prevLenRef.current = orderListLength;
  }, [orderListLength]);

  return { revealIndex, revealAnimating: animating };
}

export default useSequentialReveal;
