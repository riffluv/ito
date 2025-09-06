import { finalizeReveal } from "@/lib/game/room";
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
}

export function useRevealAnimation({
  roomId,
  roomStatus,
  resolveMode,
  orderListLength,
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

  // リアルタイム判定: revealIndexが変わるたびに現在までの結果を計算
  useEffect(() => {
    const performRealtimeJudgment = async () => {
      // 2枚目以降がめくられた時のみ判定（1枚では判定不可）
      if (!revealAnimating || revealIndex < 2) return;
      
      // 既に結果がある場合は重複判定を避ける
      if (realtimeResult && realtimeResult.currentIndex >= revealIndex) {
        return;
      }


      try {
        const { requireDb } = await import("@/lib/firebase/require");
        const { doc, getDoc } = await import("firebase/firestore");
        const { evaluateSorted } = await import("@/lib/game/rules");

        const _db = requireDb();
        const roomRef = doc(_db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);
        
        if (!roomSnap.exists()) return;
        const room = roomSnap.data();
        const order = room.order;
        
        if (!order?.list || !order?.numbers) return;

        // 現在のrevealIndexまでの範囲で判定
        const currentList = order.list.slice(0, revealIndex);
        const numbers = order.numbers;
        
        const result = evaluateSorted(currentList, numbers);
        
        setRealtimeResult({
          success: result.success,
          failedAt: result.failedAt,
          currentIndex: revealIndex,
        });

        // 失敗が検出された場合、最終結果をサーバーに保存（一度だけ）
        if (!result.success && result.failedAt !== null && !realtimeResult) {
          try {
            const { runTransaction, serverTimestamp } = await import("firebase/firestore");
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
        // 全カードが成功した場合（一度だけ）
        else if (result.success && revealIndex === orderListLength && !realtimeResult) {
          try {
            const { runTransaction, serverTimestamp } = await import("firebase/firestore");
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
    const timer = setTimeout(() => {
      setRevealIndex((i) => {
        if (i >= orderListLength) return i;
        return i + 1;
      });
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
