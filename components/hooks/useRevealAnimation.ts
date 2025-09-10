import { finalizeReveal } from "@/lib/game/room";
import { evaluateSorted } from "@/lib/game/rules";
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
  resolveMode?: string;
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
    }
    prevStatusRef.current = roomStatus;
  }, [roomStatus, resolveMode, orderListLength, revealAnimating, revealIndex]);

  // リアルタイム判定を削除（重複判定排除のため）
  // メインの判定は下のuseEffectに統一

  // Handle reveal animation progression（最後の1枚後に余韻を入れる）
  useEffect(() => {
    if (!revealAnimating) return;

    if (revealIndex > orderListLength) {
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
      const startTime = performance.now();
      console.log(`[DEBUG] カード${revealIndex + 1}のめくり処理開始: ${startTime.toFixed(2)}ms`);
      
      // 次にめくる枚数（この時点ではまだ state 更新前）
      const nextIndex = Math.min(revealIndex + 1, orderListLength);

      // インデックスを進めると同時にリアルタイム判定・色付与（遅延なし）
      setRevealIndex((i) => (i >= orderListLength ? i : i + 1));
      
      const indexUpdateTime = performance.now();
      console.log(`[DEBUG] カード${nextIndex} revealIndex更新完了: ${(indexUpdateTime - startTime).toFixed(2)}ms`);

      // めくり完了と同時に色付与（遅延削除）
      try {
        if (nextIndex >= 2 && orderData?.list && orderData?.numbers) {
          const evalStartTime = performance.now();
          const currentList = orderData.list.slice(0, nextIndex);
          const result = evaluateSorted(currentList, orderData.numbers);
          const evalEndTime = performance.now();
          console.log(`[DEBUG] カード${nextIndex} evaluateSorted処理: ${(evalEndTime - evalStartTime).toFixed(2)}ms`);
          
          // 失敗 or 成功をめくり完了と同時にUIへ反映
          // 失敗時も currentIndex は毎回更新（カードの色変化のため）
          if (!result.success && result.failedAt !== null) {
            // 失敗状態だが currentIndex は更新（軽量な更新）
            console.log(`[DEBUG] カード${nextIndex} 失敗状態でcurrentIndex更新`);
            setRealtimeResult({
              success: false,
              failedAt: result.failedAt,
              currentIndex: nextIndex, // これは毎回更新が必要
            });
          } else {
            // 成功継続時は毎回更新
            setRealtimeResult({
              success: result.success,
              failedAt: result.failedAt,
              currentIndex: nextIndex,
            });
          }
          
          const stateUpdateTime = performance.now();
          console.log(`[DEBUG] カード${nextIndex} realtimeResult更新完了: ${(stateUpdateTime - evalEndTime).toFixed(2)}ms`);

          // 【テスト用】サーバー保存を一時的に無効化
          if (!result.success && result.failedAt !== null) {
            console.log(`[DEBUG] 失敗検出: カード${nextIndex}, failedAt: ${result.failedAt}`);
            // サーバー保存を完全に無効化してテスト
          }
          // 成功時で最後のカードの場合は成功結果を保存（完全非同期）
          else if (result.success && nextIndex === orderListLength) {
            // 即座に非同期で実行（めくりリズムに影響させない）
            Promise.resolve().then(async () => {
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
                console.warn("成功保存エラー:", e);
              }
            });
          }
        }
      } catch (e) {
        console.warn("リアルタイム判定エラー:", e);
      }
      
      const endTime = performance.now();
      console.log(`[DEBUG] カード${nextIndex} 処理完了: 合計${(endTime - startTime).toFixed(2)}ms`);
    }, delay);

    return () => clearTimeout(timer);
  }, [revealAnimating, revealIndex, orderListLength, roomId, orderData]);

  // Turn off the local animation flag when the server reports finished.
  useEffect(() => {
    if (roomStatus === "finished") {
      setRevealAnimating(false);
      // リアルタイム結果は保持する（最終表示で使用するため）
      // setRealtimeResult(null);
    }
  }, [roomStatus]);

  return {
    revealAnimating,
    revealIndex,
    realtimeResult,
  } as const;
}
