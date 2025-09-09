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
  const [realtimeResult, setRealtimeResult] = useState<RealtimeResult | null>(null);
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

  // リアルタイム判定: revealIndexが変わるたびに現在までの結果を計算（フォールバック兼、成功時処理）
  useEffect(() => {
    const performRealtimeJudgment = async () => {
      // 2枚目以降がめくられた時のみ判定（1枚では判定不可）
      if (!revealAnimating || revealIndex < 2) return;
      
      // 既に結果がある場合は重複判定を避ける
      if (realtimeResult && realtimeResult.currentIndex >= revealIndex) {
        return;
      }


      try {
        // リアルタイムデータを使用（getDoc削除でデータ不整合を解決）
        if (!orderData?.list || !orderData?.numbers) return;

        // 現在のrevealIndexまでの範囲で判定
        const currentList = orderData.list.slice(0, revealIndex);
        const numbers = orderData.numbers;
        
        const result = evaluateSorted(currentList, numbers);
        
        // 失敗の場合は即座にrealtimeResultを設定
        if (!result.success) {
          setRealtimeResult({
            success: result.success,
            failedAt: result.failedAt,
            currentIndex: revealIndex,
          });
        }
        // 成功の場合はrealtimeResultを設定しない（余韻のため）

  // 失敗が検出された場合、最終結果をサーバーに保存（一度だけ）
        if (!result.success && result.failedAt !== null && !realtimeResult) {
          try {
            const { requireDb } = await import("@/lib/firebase/require");
            const { doc, runTransaction, serverTimestamp } = await import("firebase/firestore");
            
            const _db = requireDb();
            const roomRef = doc(_db, "rooms", roomId);
            
            await runTransaction(_db, async (tx) => {
              const currentSnap = await tx.get(roomRef);
              if (!currentSnap.exists()) return;
              const currentRoom = currentSnap.data();
              
              // 既に結果が保存されている場合はスキップ
              if (currentRoom.result) return;
              
              tx.update(roomRef, {
                result: {
                  success: false,
                  failedAt: result.failedAt,
                  lastNumber: result.last,
                  revealedAt: serverTimestamp(),
                },
              });
            });
          } catch (error) {
            console.warn("失敗結果保存エラー:", error);
          }
        }
        // 全カードが成功した場合（一度だけ）- 余韻のため少し遅延
        else if (result.success && revealIndex === orderListLength && !realtimeResult) {
          // 成功時も失敗時と同じように余韻を作る（1.5秒遅延）
          setTimeout(async () => {
            try {
              // まずrealtimeResultを設定（成功アニメーション発火）
              setRealtimeResult({
                success: true,
                failedAt: null,
                currentIndex: revealIndex,
              });
              
              const { requireDb } = await import("@/lib/firebase/require");
              const { doc, runTransaction, serverTimestamp } = await import("firebase/firestore");
              
              const _db = requireDb();
              const roomRef = doc(_db, "rooms", roomId);
              
              await runTransaction(_db, async (tx) => {
                const currentSnap = await tx.get(roomRef);
                if (!currentSnap.exists()) return;
                const currentRoom = currentSnap.data();
                
                // 既に結果が保存されている場合はスキップ
                if (currentRoom.result) return;
                
                tx.update(roomRef, {
                  result: {
                    success: true,
                    failedAt: null,
                    lastNumber: result.last,
                    revealedAt: serverTimestamp(),
                  },
                });
              });
            } catch (error) {
              console.warn("成功結果保存エラー:", error);
            }
          }, 1500); // 1.5秒の余韻を追加
        }
      } catch (error) {
        console.warn("リアルタイム判定エラー:", error);
      }
    };

    performRealtimeJudgment();
  }, [revealAnimating, revealIndex, roomId, orderListLength, realtimeResult]);

  // Handle reveal animation progression（最後の1枚後に余韻を入れる）
  useEffect(() => {
    if (!revealAnimating) return;

    if (revealIndex >= orderListLength) {
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

      // 同期的に即時判定: 2枚目以降、かつ orderData が揃っている場合
      try {
        if (nextIndex >= 2 && orderData?.list && orderData?.numbers) {
          const currentList = orderData.list.slice(0, nextIndex);
          const result = evaluateSorted(currentList, orderData.numbers);
          if (!result.success) {
            // ここで即座に失敗結果を反映（色タイミングをカードの反転と一致させる）
            setRealtimeResult({
              success: false,
              failedAt: result.failedAt,
              currentIndex: nextIndex,
            });
            // サーバーへも一度だけ保存（冪等ガードはトランザクション内で）
            try {
              const { requireDb } = await import("@/lib/firebase/require");
              const { doc, runTransaction, serverTimestamp } = await import("firebase/firestore");
              const _db = requireDb();
              const roomRef = doc(_db, "rooms", roomId);
              await runTransaction(_db, async (tx) => {
                const currentSnap = await tx.get(roomRef);
                if (!currentSnap.exists()) return;
                const currentRoom = currentSnap.data() as any;
                if (currentRoom.result) return; // 既に保存済み
                tx.update(roomRef, {
                  result: {
                    success: false,
                    failedAt: result.failedAt,
                    lastNumber: result.last,
                    revealedAt: serverTimestamp(),
                  },
                });
              });
            } catch (e) {
              console.warn("即時失敗保存エラー:", e);
            }
          }
        }
      } catch (e) {
        console.warn("即時判定エラー:", e);
      }

      // 最後にインデックスを進める（同一レンダーで realtimeResult と revealIndex を反映）
      setRevealIndex((i) => (i >= orderListLength ? i : i + 1));
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

  return {
    revealAnimating,
    revealIndex,
    realtimeResult,
  } as const;
}
