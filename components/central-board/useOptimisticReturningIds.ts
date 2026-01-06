import { notify } from "@/components/ui/notify";
import { removeCardFromProposal } from "@/lib/game/room";
import type { RoomDoc } from "@/lib/types";
import { logError } from "@/lib/utils/log";
import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

type PendingStateUpdater = (updater: (prev: (string | null)[]) => (string | null)[]) => void;

export function useOptimisticReturningIds(params: {
  roomId: string;
  roomStatus: RoomDoc["status"];
  proposal: (string | null)[] | null | undefined;
  proposalKey: string;
  optimisticReturningIds: string[];
  setOptimisticReturningIds: Dispatch<SetStateAction<string[]>>;
  returningTimeoutsRef: MutableRefObject<Map<string, ReturnType<typeof setTimeout>>>;
  updatePendingState: PendingStateUpdater;
  playCardPlace: () => void;
  playDropInvalid: () => void;
}): { returnCardToWaiting: (playerId: string) => Promise<boolean> } {
  const {
    roomId,
    roomStatus,
    proposal,
    proposalKey,
    optimisticReturningIds,
    setOptimisticReturningIds,
    returningTimeoutsRef,
    updatePendingState,
    playCardPlace,
    playDropInvalid,
  } = params;

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const onCardReturning = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string; playerId?: string }>).detail;
      if (!detail || detail.roomId !== roomId || !detail.playerId) return;
      const playerId = detail.playerId;
      setOptimisticReturningIds((prev) => (prev.includes(playerId) ? prev : [...prev, playerId]));

      // タイムアウトを設定: 2秒後に強制クリア（サーバー応答がない場合の保険）
      const existingTimeout = returningTimeoutsRef.current.get(playerId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      const timeout = setTimeout(() => {
        returningTimeoutsRef.current.delete(playerId);
        setOptimisticReturningIds((prev) => prev.filter((id) => id !== playerId));
      }, 2000);
      returningTimeoutsRef.current.set(playerId, timeout);
    };

    window.addEventListener("ito:card-returning", onCardReturning as EventListener);
    const timeoutsMap = returningTimeoutsRef.current;
    return () => {
      window.removeEventListener("ito:card-returning", onCardReturning as EventListener);
      // クリーンアップ時に全タイムアウトをクリア
      timeoutsMap.forEach((timeout) => clearTimeout(timeout));
      timeoutsMap.clear();
    };
  }, [roomId, returningTimeoutsRef, setOptimisticReturningIds]);

  useEffect(() => {
    if (!optimisticReturningIds.length) return;
    if (!proposal || proposal.length === 0) {
      setOptimisticReturningIds([]);
      return;
    }
    const proposalSet = new Set(
      (proposal as (string | null)[]).filter((id): id is string => typeof id === "string" && id.length > 0)
    );
    setOptimisticReturningIds((prev) => prev.filter((id) => proposalSet.has(id)));
  }, [proposal, proposalKey, optimisticReturningIds.length, setOptimisticReturningIds]);

  useEffect(() => {
    if (roomStatus !== "clue") {
      setOptimisticReturningIds([]);
    }
  }, [roomStatus, setOptimisticReturningIds]);

  const returnCardToWaiting = useCallback(
    async (playerId: string) => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("ito:card-returning", {
            detail: { roomId, playerId },
          })
        );
      }
      // ロールバック用に現在の pending のインデックスを保存
      let previousIndex = -1;
      updatePendingState((prev) => {
        previousIndex = prev.indexOf(playerId);
        return prev.filter((id) => id !== playerId);
      });
      try {
        await removeCardFromProposal(roomId, playerId);
        playCardPlace();
        return true;
      } catch (error) {
        logError("central-card-board", "remove-card-from-proposal", error);
        playDropInvalid();
        // エラー時: pending を元に戻す（ロールバック）
        if (previousIndex >= 0) {
          updatePendingState((prev) => {
            // 既に戻っている場合はスキップ
            if (prev.includes(playerId)) return prev;
            const next = prev.slice();
            // 元のインデックスに戻せるなら戻す、無理なら末尾に追加
            if (previousIndex < next.length) {
              next.splice(previousIndex, 0, playerId);
            } else {
              next.push(playerId);
            }
            return next;
          });
        }
        // optimisticReturningIds からも削除（カードを再表示するため）
        setOptimisticReturningIds((prev) => prev.filter((id) => id !== playerId));
        notify({
          title: "カードを戻せませんでした",
          type: "error",
          duration: 1200,
        });
        return false;
      }
    },
    [playCardPlace, playDropInvalid, roomId, setOptimisticReturningIds, updatePendingState]
  );

  return { returnCardToWaiting };
}
