import { SEQ_FIRST_CLUE_MS, SEQ_FLIP_INTERVAL_MS } from "@/lib/ui/motion";
import { useEffect, useRef, useState } from "react";

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
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());
  const [revealIndex, setRevealIndex] = useState(0); // flipped 数（後方互換）
  const [animating, setAnimating] = useState(false);
  const prevLenRef = useRef(0); // 前回確定した count 基準
  const timersRef = useRef<number[]>([]);
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
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      prevLenRef.current = 0;
      seenIdsRef.current = currentPlaced;
      setFlippedIds(new Set());
      setRevealIndex(0);
      setAnimating(false);
    }

    // 途中でカードが減るケース（理論上稀）もリセット
    if (cur < prev) {
      // 何らかのロールバック: フリップ情報を縮退
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      const truncated = new Set<string>();
      currentPlaced
        .slice(0, flippedIds.size)
        .forEach((id) => truncated.add(id));
      setFlippedIds(truncated);
      prevLenRef.current = cur;
      setRevealIndex(truncated.size);
      setAnimating(false);
      seenIdsRef.current = currentPlaced;
      return;
    }

    // 追加分をスケジュール: 成功で status が 'reveal' に一気に遷移したケースでも
    // アニメ（clue→flip）の猶予を確保したいので 'reveal' も許容する。
    // （failure で 'finished' になった場合は即時フリップ継続で良い想定）
    if (cur > prev && (roomStatus === "clue" || roomStatus === "reveal")) {
      // 追加された ID 群を特定（末尾のみ想定）
      const newIds = currentPlaced.slice(prevPlaced.length);
      if (newIds.length > 0) {
        setAnimating(true);
        newIds.forEach((id, i) => {
          // 1枚目は firstDelayMs、2枚目以降は flipDelayMs
          const globalIndex = flippedIds.size + i;
          const delay = globalIndex === 0 ? firstDelayMs : flipDelayMs;
          const t = window.setTimeout(() => {
            setFlippedIds((s) => {
              if (s.has(id)) return s; // 冪等
              const ns = new Set(s);
              ns.add(id);
              // revealIndex を flipped 数と同期
              setRevealIndex(ns.size);
              return ns;
            });
            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.debug("[seqReveal] flip id", { id, delay });
            }
          }, delay);
          timersRef.current.push(t as unknown as number);
        });
        // アニメ終了判定: 最大遅延 + 安全に 10ms
        const maxDelay = Math.max(...newIds.map((_, i) => {
          const globalIndex = flippedIds.size + i;
          return globalIndex === 0 ? firstDelayMs : flipDelayMs;
        }));
        const totalDelay = maxDelay + 10;
        const endT = window.setTimeout(() => {
          setAnimating(false);
          if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.debug("[seqReveal] batch complete", { newIds });
          }
        }, totalDelay);
        timersRef.current.push(endT as unknown as number);
      }
      prevLenRef.current = cur;
      seenIdsRef.current = currentPlaced;
    }
    // 'reveal' では即強制全開示しない（上の条件でスケジュール済み）。
    // 'finished' 到達時のみ残タスクを全て消化して強制的に最終状態へ。
    if (roomStatus === "finished") {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      // 全カード強制 flip
      const full = new Set(currentPlaced);
      setFlippedIds(full);
      setRevealIndex(full.size);
      setAnimating(false);
      prevLenRef.current = cur;
      seenIdsRef.current = currentPlaced;
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

  // flippedIds 変更時に revealIndex を同期（冪等安全）
  useEffect(() => {
    setRevealIndex(flippedIds.size);
  }, [flippedIds]);

  return { revealIndex, revealAnimating: animating, flippedIds };
}

export default useSequentialReveal;
