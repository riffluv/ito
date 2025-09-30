import { finalizeReveal } from "@/lib/game/room";
import { evaluateSorted } from "@/lib/game/rules";
import type { ResolveMode } from "@/lib/game/resolveMode";
import { logDebug, logWarn } from "@/lib/utils/log";
import {
  REVEAL_FIRST_DELAY,
  REVEAL_LINGER,
  REVEAL_STEP_DELAY,
} from "@/lib/ui/motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
}

export function useRevealAnimation({
  roomId,
  roomStatus,
  resolveMode,
  orderListLength,
  orderData,
}: UseRevealAnimationProps) {
  const [revealAnimating, setRevealAnimating] = useState(false);
  const [revealIndex, setRevealIndex] = useState(0);
  const [realtimeResult, setRealtimeResult] = useState<RealtimeResult | null>(
    null
  );
  const prevStatusRef = useRef(roomStatus);

  // Start reveal animation: useLayoutEffect so we set the flag before the
  // browser paints. This avoids a render where `roomStatus === 'reveal'` but
  // `revealAnimating` is still false, which caused a brief undesired frame
  // where cards appeared in the default (dark) state.
  useLayoutEffect(() => {
    const prev = prevStatusRef.current;
    const becameReveal = prev !== "reveal" && roomStatus === "reveal";
    const isRevealNow = roomStatus === "reveal";
    const shouldStart =
      resolveMode === "sort-submit" &&
      orderListLength > 0 &&
      (becameReveal || (isRevealNow && !revealAnimating && revealIndex === 0));

    if (shouldStart) {
      setRevealAnimating(true);
      setRevealIndex(0);
      setRealtimeResult(null); // リセット
      logDebug("reveal", "start", { orderListLength });
    }
    prevStatusRef.current = roomStatus;
  }, [roomStatus, resolveMode, orderListLength, revealAnimating, revealIndex]);

  // Handle reveal animation progression
  useEffect(() => {
    if (!revealAnimating) return;

    if (revealIndex >= orderListLength) {
      logDebug("reveal", "all-cards-revealed", { revealIndex, orderListLength });
      // Keep the animation flag true during the linger period so the UI
      // doesn't revert to the "face-down" state while waiting to finalize.
      const linger = setTimeout(() => {
        // Trigger finalize on the server; do NOT change revealAnimating
        // here. We'll observe `roomStatus` and clear the flag when the
        // server-side state moves to 'finished'.
        finalizeReveal(roomId).catch(() => void 0);
      }, REVEAL_LINGER);
      return () => clearTimeout(linger);
    }

    // First card has shorter delay to avoid "frozen" impression
    const delay = revealIndex === 0 ? REVEAL_FIRST_DELAY : REVEAL_STEP_DELAY;
    
    const timer = setTimeout(async () => {

      // 次にめくる枚数（この時点ではまだ state 更新前）
      const nextIndex = Math.min(revealIndex + 1, orderListLength);

      // インデックスを進める（めくり開始）
      setRevealIndex((i) => (i >= orderListLength ? i : i + 1));


      // めくり完了後に色付与（350ms後 = めくりアニメーション完了後）
      setTimeout(() => {
        try {
          if (nextIndex >= 2 && orderData?.list && orderData?.numbers) {
            const currentList = orderData.list.slice(0, nextIndex);
            const result = evaluateSorted(currentList, orderData.numbers);
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
            setTimeout(async () => {
              try {
                const { requireDb } = await import("@/lib/firebase/require");
                const { doc, runTransaction, serverTimestamp } = await import(
                  "firebase/firestore"
                );
                const _db = requireDb();
                const roomRef = doc(_db, "rooms", roomId);
                await runTransaction(_db, async (tx) => {
                  const currentSnap = await tx.get(roomRef);
                  if (!currentSnap.exists()) return;
                  const currentRoom = currentSnap.data() as any;
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
            }, 0);
          }
        }
      } catch (e) {
        logDebug("reveal", "realtime-eval-error", e);
      }
      }, 350); // めくり完了後に色付与（350ms = GSAPアニメーション時間）
    }, delay);

    return () => clearTimeout(timer);
  }, [revealAnimating, revealIndex, orderListLength, roomId]);

  // Turn off the local animation flag when the server reports finished.
  useEffect(() => {
    if (roomStatus === "finished") {
      setRevealAnimating(false);
      // リアルタイム結果は保持する（最終表示で使用するため）
      // setRealtimeResult(null);
    }
  }, [roomStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const event = new CustomEvent("ito:reveal-animating", {
        detail: { roomId, animating: revealAnimating },
      });
      window.dispatchEvent(event);
    } catch {
      /* ignore */
    }
  }, [revealAnimating, roomId]);

  return {
    revealAnimating,
    revealIndex,
    realtimeResult,
  } as const;
}
