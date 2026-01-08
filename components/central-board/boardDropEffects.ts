import type { Dispatch, SetStateAction } from "react";

import { createDropMetricsSession, DROP_OPTIMISTIC_ENABLED } from "@/components/hooks/useDropHandler";
import { notify } from "@/components/ui/notify";
import {
  scheduleAddCardToProposalAtPosition,
  scheduleMoveCardInProposalToPosition,
} from "@/lib/game/proposalScheduler";
import { logError } from "@/lib/utils/log";
import { traceAction } from "@/lib/utils/trace";

type PendingStateUpdater = (updater: (prev: (string | null)[]) => (string | null)[]) => void;

export function handleSlotDropEffects(params: {
  roomId: string;
  activePlayerId: string;
  slotIndex: number;
  operation: "add" | "move";
  onOptimisticProposalChange?: (
    playerId: string,
    state: "placed" | "removed" | null,
    targetIndex?: number | null
  ) => void;
  updatePendingState: PendingStateUpdater;
  scheduleDropRollback: (playerId: string, snapshot: (string | null)[]) => void;
  clearDropRollbackTimer: (playerId?: string) => void;
  playCardPlace: () => void;
  playDropInvalid: () => void;
  clearOptimisticProposal: () => void;
  setOptimisticReturningIds: Dispatch<SetStateAction<string[]>>;
  applyOptimisticReorder: (playerId: string, targetIndex: number) => void;
}): void {
  const {
    roomId,
    activePlayerId,
    slotIndex,
    operation,
    onOptimisticProposalChange,
    updatePendingState,
    scheduleDropRollback,
    clearDropRollbackTimer,
    playCardPlace,
    playDropInvalid,
    clearOptimisticProposal,
    setOptimisticReturningIds,
    applyOptimisticReorder,
  } = params;

  let dropSession: ReturnType<typeof createDropMetricsSession> | null = null;
  let previousPending: (string | null)[] | undefined;
  let insertedPending = false;
  let didPlaySound = false;
  const playOnce = () => {
    if (didPlaySound) return;
    didPlaySound = true;
    playCardPlace();
    dropSession?.markStage("client.drop.t3_soundPlayedMs", {
      channel: "success",
    });
  };

  if (operation === "add") {
    dropSession = createDropMetricsSession({
      optimisticMode: DROP_OPTIMISTIC_ENABLED,
      index: slotIndex,
    });
    onOptimisticProposalChange?.(activePlayerId, "placed", slotIndex);
    updatePendingState((prev) => {
      previousPending = prev.slice();
      const next = [...prev];
      const exist = next.indexOf(activePlayerId);
      if (exist >= 0) next.splice(exist, 1);
      if (slotIndex >= next.length) {
        next.length = slotIndex + 1;
      }
      next[slotIndex] = activePlayerId;
      insertedPending = true;
      return next;
    });
    if (insertedPending) {
      scheduleDropRollback(activePlayerId, previousPending ? previousPending.slice() : []);
    }
  }

  if (operation === "move") {
    playOnce();
    scheduleMoveCardInProposalToPosition(roomId, activePlayerId, slotIndex).catch(
      (error) => {
        logError("central-card-board", "move-card-in-proposal", error);
        playDropInvalid();
        clearOptimisticProposal();
        // エラー時は楽観返却状態もクリア
        setOptimisticReturningIds((prev) => prev.filter((id) => id !== activePlayerId));
      }
    );
    applyOptimisticReorder(activePlayerId, slotIndex);
    return;
  }

  const request = scheduleAddCardToProposalAtPosition(
    roomId,
    activePlayerId,
    slotIndex
  );
  if (insertedPending) {
    playOnce();
  }
  request
    .then((result) => {
      clearDropRollbackTimer(activePlayerId);
      dropSession?.markStage("client.drop.t2_addProposalResolvedMs", {
        result,
      });
      if (result === "noop") {
        dropSession?.complete("noop");
        onOptimisticProposalChange?.(activePlayerId, null);
        // noop 時は optimisticProposal もクリア
        clearOptimisticProposal();
        if (previousPending !== undefined) {
          const snapshot = previousPending.slice();
          updatePendingState(() => snapshot);
        }
        notify({
          title: "その位置には置けません",
          description: "カードが既に置かれているか、提案が更新されています。",
          type: "info",
        });
        playDropInvalid();
        dropSession?.markStage("client.drop.t1_notifyShownMs", {
          origin: "post",
        });
        traceAction("board.drop.attempt", {
          roomId,
          playerId: activePlayerId,
          targetSlot: slotIndex,
          reasonIfRejected: "slot-occupied",
        });
        return;
      }
      playOnce();
      dropSession?.complete("success");
    })
    .catch((error) => {
      clearDropRollbackTimer(activePlayerId);
      dropSession?.markStage("client.drop.t2_addProposalResolvedMs", {
        result: "error",
      });
      dropSession?.complete("error");
      logError("central-card-board", "add-card-to-proposal", error);
      onOptimisticProposalChange?.(activePlayerId, null);
      // エラー時も optimisticProposal をクリア
      clearOptimisticProposal();
      if (previousPending !== undefined) {
        const snapshot = previousPending.slice();
        updatePendingState(() => snapshot);
      }
      const errorCode = (error as { code?: unknown } | null)?.code;
      const isNetworkError = error instanceof TypeError || errorCode === "timeout";
      notify({
        title: isNetworkError ? "通信に失敗しました" : "カードをその位置に置けませんでした",
        description: isNetworkError
          ? "ネットワークが不安定か、サーバーが応答しませんでした。もう一度お試しください。"
          : error instanceof Error
            ? error.message
            : undefined,
        type: "error",
        duration: 1400,
        meta: {
          cooldownMs: 1200,
          cooldownKey: `drop:proposal:${roomId}`,
        },
      });
      playDropInvalid();
      dropSession?.markStage("client.drop.t1_notifyShownMs", {
        origin: "error",
      });
      traceAction("board.drop.attempt", {
        roomId,
        playerId: activePlayerId,
        targetSlot: slotIndex,
        reasonIfRejected: "error",
      });
    });
}

export function handleMoveToCardDropEffects(params: {
  roomId: string;
  activePlayerId: string;
  targetIndex: number;
  playCardPlace: () => void;
  playDropInvalid: () => void;
  clearOptimisticProposal: () => void;
  setOptimisticReturningIds: Dispatch<SetStateAction<string[]>>;
  applyOptimisticReorder: (playerId: string, targetIndex: number) => void;
}): void {
  const {
    roomId,
    activePlayerId,
    targetIndex,
    playCardPlace,
    playDropInvalid,
    clearOptimisticProposal,
    setOptimisticReturningIds,
    applyOptimisticReorder,
  } = params;

  playCardPlace();
  scheduleMoveCardInProposalToPosition(roomId, activePlayerId, targetIndex).catch(
    (error) => {
      logError("central-card-board", "move-card-in-proposal", error);
      playDropInvalid();
      const errorCode = (error as { code?: unknown } | null)?.code;
      const isNetworkError = error instanceof TypeError || errorCode === "timeout";
      notify({
        title: isNetworkError
          ? "通信に失敗しました"
          : "カードをその位置に移動できませんでした",
        description: isNetworkError
          ? "ネットワークが不安定か、サーバーが応答しませんでした。もう一度お試しください。"
          : error instanceof Error
            ? error.message
            : undefined,
        type: "error",
        duration: 1400,
        meta: {
          cooldownMs: 1200,
          cooldownKey: `drop:proposal:${roomId}`,
        },
      });
      clearOptimisticProposal();
      // エラー時は楽観返却状態もクリア
      setOptimisticReturningIds((prev) => prev.filter((id) => id !== activePlayerId));
    }
  );
  applyOptimisticReorder(activePlayerId, targetIndex);
}

export function handleReturnDropEffects(params: {
  activePlayerId: string;
  allowed: boolean;
  reason?: string;
  onOptimisticProposalChange?: (
    playerId: string,
    state: "placed" | "removed" | null,
    targetIndex?: number | null
  ) => void;
  returnCardToWaiting: (playerId: string) => Promise<boolean>;
  playDropInvalid: () => void;
}): void {
  const {
    activePlayerId,
    allowed,
    reason,
    onOptimisticProposalChange,
    returnCardToWaiting,
    playDropInvalid,
  } = params;

  if (!allowed) {
    playDropInvalid();
    if (reason === "notOwner") {
      notify({
        title: "自分のカードだけ戻せます",
        type: "info",
        duration: 1200,
      });
    }
    return;
  }

  onOptimisticProposalChange?.(activePlayerId, "removed");
  returnCardToWaiting(activePlayerId)
    .then((ok) => {
      if (!ok) {
        onOptimisticProposalChange?.(activePlayerId, null);
      }
    })
    .catch((error) => {
      onOptimisticProposalChange?.(activePlayerId, null);
      logError("central-card-board", "return-card-to-waiting", error);
      playDropInvalid();
      const message =
        error instanceof Error
          ? error.message
          : error !== null && error !== undefined
            ? String(error)
            : "";
      notify({
        title: "カードを戻せませんでした",
        description: message || undefined,
        type: "error",
      });
    });
}
