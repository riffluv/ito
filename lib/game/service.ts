import { type DealNumbersOptions } from "@/lib/game/room";
import { topicControls } from "@/lib/game/topicControls";
import { db } from "@/lib/firebase/client";
import { withPermissionRetry } from "@/lib/firebase/permissionGuard";
import { bumpMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { spectatorV2Service } from "@/lib/spectator/v2/service";
import {
  apiStartGame,
  apiSubmitOrder,
  apiResetRoom,
  apiMutateProposal,
  apiCommitPlay,
  apiDealNumbers,
  apiFinalizeReveal,
  apiPruneProposal,
  apiSetRevealPending,
  apiSetRoundPreparing,
} from "@/lib/services/roomApiClient";

export type ResetRoomKeepIds = string[] | null | undefined;
export type ResetRoomOptions = { notifyChat?: boolean; recallSpectators?: boolean };

export type StartGameOptions = {
  allowFromFinished?: boolean;
  allowFromClue?: boolean;
  autoDeal?: boolean;
  topicType?: string | null;
  customTopic?: string | null;
  sessionId?: string | null;
};

export async function startGame(roomId: string, requestId: string, sessionIdOrOpts?: string | null | StartGameOptions) {
  const opts = typeof sessionIdOrOpts === "string" || sessionIdOrOpts === null || sessionIdOrOpts === undefined
    ? { sessionId: sessionIdOrOpts }
    : sessionIdOrOpts ?? {};
  traceAction("host.start", { roomId });
  try {
    return await withPermissionRetry(
      () =>
        apiStartGame(roomId, {
          requestId,
          sessionId: opts.sessionId ?? undefined,
          allowFromFinished: opts.allowFromFinished,
          allowFromClue: opts.allowFromClue,
          autoDeal: opts.autoDeal,
          topicType: opts.topicType,
          customTopic: opts.customTopic,
        }),
      { context: "host.start", toastContext: "ゲーム開始" }
    );
  } catch (error) {
    traceError("host.start", error, { roomId });
    throw error;
  }
}

export async function dealNumbers(
  roomId: string,
  options?: DealNumbersOptions
) {
  traceAction("numbers.deal", { roomId });
  try {
    const requestId =
      (options as { requestId?: string } | undefined)?.requestId ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return await withPermissionRetry(
      async () => {
        const result = await apiDealNumbers(roomId, {
          skipPresence: options?.skipPresence,
          requestId,
          sessionId: (options as { sessionId?: string | null } | undefined)?.sessionId ?? undefined,
        });
        return result.count;
      },
      { context: "numbers.deal", toastContext: "カード配布" }
    );
  } catch (error) {
    traceError("numbers.deal", error, { roomId });
    throw error;
  }
}

export async function addCardToProposal(roomId: string, playerId: string) {
  traceAction("card.add", { roomId, playerId });
  try {
    return await withPermissionRetry(
      () => apiMutateProposal({ roomId, playerId, action: "add", targetIndex: -1 }).then((r) => r.status),
      { context: "card.add", toastContext: "カードを置く操作" }
    );
  } catch (error) {
    traceError("card.add", error, { roomId, playerId });
    throw error;
  }
}

export async function removeCardFromProposal(
  roomId: string,
  playerId: string
) {
  traceAction("card.remove", { roomId, playerId });
  try {
    return await withPermissionRetry(
      () => apiMutateProposal({ roomId, playerId, action: "remove" }).then((r) => r.status),
      { context: "card.remove", toastContext: "カードを戻す操作" }
    );
  } catch (error) {
    traceError("card.remove", error, { roomId, playerId });
    throw error;
  }
}

export async function commitPlayFromClue(roomId: string, playerId: string) {
  traceAction("clue.commit", { roomId, playerId });
  try {
    return await withPermissionRetry(
      () => apiCommitPlay(roomId, playerId),
      { context: "clue.commit", toastContext: "ヒント提出" }
    );
  } catch (error) {
    traceError("clue.commit", error, { roomId, playerId });
    throw error;
  }
}

export async function submitSortedOrder(roomId: string, list: string[]) {
  traceAction("order.submit", { roomId, size: list.length });
  try {
    return await withPermissionRetry(
      () => apiSubmitOrder(roomId, list),
      { context: "order.submit", toastContext: "並び順の提出" }
    );
  } catch (error) {
    traceError("order.submit", error, { roomId, size: list.length });
    throw error;
  }
}

export async function resetRoomWithPrune(
  roomId: string,
  keepIds: ResetRoomKeepIds,
  opts: ResetRoomOptions & { requestId: string; sessionId?: string | null }
) {
  traceAction("room.reset", {
    roomId,
    keep: Array.isArray(keepIds)
      ? String(keepIds.length)
      : keepIds === null || keepIds === undefined
        ? "0"
        : "custom",
  });
  try {
    return await withPermissionRetry(
      () => apiResetRoom(roomId, opts?.recallSpectators ?? true, opts?.requestId, opts?.sessionId),
      { context: "room.reset", toastContext: "ゲームのリセット" }
    );
  } catch (error) {
    traceError("room.reset", error, {
      roomId,
      keep: Array.isArray(keepIds)
        ? String(keepIds.length)
        : keepIds === null || keepIds === undefined
          ? "0"
          : "custom",
    });
    throw error;
  }
}

export async function finalizeReveal(roomId: string) {
  traceAction("reveal.finalize", { roomId });
  try {
    return await withPermissionRetry(
      () => apiFinalizeReveal(roomId),
      { context: "reveal.finalize", toastContext: "結果確定" }
    );
  } catch (error) {
    traceError("reveal.finalize", error, { roomId });
    throw error;
  }
}

// =============================
// UI Shared Gate: revealPending
// =============================

export async function beginRevealPending(roomId: string) {
  try {
    traceAction("ui.revealPending.begin", { roomId });
    await withPermissionRetry(
      () => apiSetRevealPending(roomId, true),
      { context: "ui.revealPending.begin", suppressToast: true }
    );
  } catch (error) {
    traceError("ui.revealPending.begin", error, { roomId });
    throw error;
  }
}

export async function clearRevealPending(roomId: string) {
  try {
    traceAction("ui.revealPending.clear", { roomId });
    await withPermissionRetry(
      () => apiSetRevealPending(roomId, false),
      { context: "ui.revealPending.clear", suppressToast: true }
    );
  } catch (error) {
    traceError("ui.revealPending.clear", error, { roomId });
    // 非致命: 失敗してもUIは自動解除されるため握りつぶす
  }
}

export async function setRoundPreparing(roomId: string, active: boolean) {
  try {
    traceAction(active ? "ui.roundPreparing.begin" : "ui.roundPreparing.clear", { roomId });
    await withPermissionRetry(
      () => apiSetRoundPreparing(roomId, active),
      { context: "ui.roundPreparing", suppressToast: true }
    );
  } catch (error) {
    traceError("ui.roundPreparing", error, { roomId, active });
  }
}

// clue中のみ、proposalから在室外IDを除去（冪等）。UI側の表示フィルタと合わせて二重で安全策。
export async function pruneProposalByEligible(
  roomId: string,
  eligibleIds: readonly string[]
) {
  try {
    await withPermissionRetry(
      () => apiPruneProposal(roomId, Array.from(eligibleIds)),
      { context: "order.proposal.prune", suppressToast: true }
    );
  } catch (error) {
    traceError("order.proposal.prune", error, { roomId });
  }
}

export { topicControls };

export async function cancelSeatRequest(roomId: string, uid: string) {
  traceAction("spectator.cancelSeatRequest", { roomId, uid });
  const run = async () => {
    if (!db) {
      throw new Error("firebase-unavailable");
    }
    const sessionQuery = query(
      collection(db, "spectatorSessions"),
      where("roomId", "==", roomId),
      where("viewerUid", "==", uid)
    );
    const snapshot = await getDocs(sessionQuery);
    if (snapshot.empty) {
      return;
    }
    let cancelled = false;
    const tasks: Promise<void>[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const rejoin = data.rejoinRequest as Record<string, unknown> | undefined;
      if (!rejoin || rejoin.status !== "pending") {
        return;
      }
      tasks.push(
        spectatorV2Service
          .cancelRejoin({ sessionId: docSnap.id, roomId })
          .then(() => {
            cancelled = true;
          })
      );
    });
    await Promise.all(tasks);
    if (cancelled) {
      bumpMetric("recall", "cancelled");
    }
  };
  try {
    await withPermissionRetry(run, {
      context: "spectator.cancelSeatRequest",
      toastContext: "観戦リクエスト",
    });
  } catch (error) {
    traceError("spectator.cancelSeatRequest", error, { roomId, uid });
    throw error;
  }
}

export const GameService = {
  startGame,
  dealNumbers,
  addCardToProposal,
  removeCardFromProposal,
  commitPlayFromClue,
  submitSortedOrder,
  resetRoomWithPrune,
  finalizeReveal,
  topicControls,
  cancelSeatRequest,
  pruneProposalByEligible,
  beginRevealPending,
  clearRevealPending,
  setRoundPreparing,
} as const;
