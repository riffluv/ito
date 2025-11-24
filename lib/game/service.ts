import {
  addCardToProposal as addCardToProposalInternal,
  commitPlayFromClue as commitPlayFromClueInternal,
  dealNumbers as dealNumbersInternal,
  removeCardFromProposal as removeCardFromProposalInternal,
  startGame as startGameInternal,
  submitSortedOrder as submitSortedOrderInternal,
  finalizeReveal as finalizeRevealInternal,
  type DealNumbersOptions,
} from "@/lib/game/room";
import {
  resetRoomWithPrune as resetRoomWithPruneInternal,
} from "@/lib/firebase/rooms";
import { topicControls } from "@/lib/game/topicControls";
import { db } from "@/lib/firebase/client";
import { withPermissionRetry } from "@/lib/firebase/permissionGuard";
import { bumpMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import type { RoomDoc } from "@/lib/types";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { spectatorV2Service } from "@/lib/spectator/v2/service";

export type ResetRoomKeepIds = Parameters<
  typeof resetRoomWithPruneInternal
>[1];
export type ResetRoomOptions = Parameters<
  typeof resetRoomWithPruneInternal
>[2];

export async function startGame(roomId: string) {
  traceAction("host.start", { roomId });
  try {
    return await withPermissionRetry(
      () => startGameInternal(roomId),
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
    return await withPermissionRetry(
      () => dealNumbersInternal(roomId, 0, options),
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
      () => addCardToProposalInternal(roomId, playerId),
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
      () => removeCardFromProposalInternal(roomId, playerId),
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
      () => commitPlayFromClueInternal(roomId, playerId),
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
      () => submitSortedOrderInternal(roomId, list),
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
  opts?: ResetRoomOptions
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
      () => resetRoomWithPruneInternal(roomId, keepIds, opts),
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
      () => finalizeRevealInternal(roomId),
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
type ServerTimestamp = ReturnType<typeof serverTimestamp>;

type RevealPendingPayload = {
  ui: {
    revealPending: boolean;
    revealBeginAt: ServerTimestamp;
  };
  lastActiveAt: ServerTimestamp;
};

export async function beginRevealPending(roomId: string) {
  if (!db) return;
  const roomRef = doc(db, "rooms", roomId);
  try {
    traceAction("ui.revealPending.begin", { roomId });
    const payload: RevealPendingPayload = {
      ui: {
        revealPending: true,
        revealBeginAt: serverTimestamp(),
      },
      lastActiveAt: serverTimestamp(),
    };
    await withPermissionRetry(
      () => setDoc(roomRef, payload, { merge: true }),
      { context: "ui.revealPending.begin", suppressToast: true }
    );
  } catch (error) {
    traceError("ui.revealPending.begin", error, { roomId });
    throw error;
  }
}

export async function clearRevealPending(roomId: string) {
  if (!db) return;
  const roomRef = doc(db, "rooms", roomId);
  try {
    traceAction("ui.revealPending.clear", { roomId });
    const payload = {
      "ui.revealPending": false,
      lastActiveAt: serverTimestamp(),
    } satisfies Record<string, unknown>;
    await withPermissionRetry(
      () => updateDoc(roomRef, payload),
      { context: "ui.revealPending.clear", suppressToast: true }
    );
  } catch (error) {
    traceError("ui.revealPending.clear", error, { roomId });
    // 非致命: 失敗してもUIは自動解除されるため握りつぶす
  }
}

export async function setRoundPreparing(roomId: string, active: boolean) {
  if (!db) return;
  const roomRef = doc(db, "rooms", roomId);
  try {
    traceAction(active ? "ui.roundPreparing.begin" : "ui.roundPreparing.clear", { roomId });
    await withPermissionRetry(
      () =>
        updateDoc(roomRef, {
          "ui.roundPreparing": active,
          lastActiveAt: serverTimestamp(),
        }),
      { context: "ui.roundPreparing", suppressToast: true }
    );
  } catch (error) {
    traceError("ui.roundPreparing", error, { roomId, active });
    // 非致命扱い: ローカルUIのみでフォローできるため握りつぶす
  }
}

// clue中のみ、proposalから在室外IDを除去（冪等）。UI側の表示フィルタと合わせて二重で安全策。
export async function pruneProposalByEligible(
  roomId: string,
  eligibleIds: readonly string[]
) {
  if (!db) return;
  const roomRef = doc(db, "rooms", roomId);
  const proposalRef = doc(db, "roomProposals", roomId);
  const eligible = new Set(eligibleIds);
  try {
    await withPermissionRetry(
      () =>
        runTransaction(db!, async (tx) => {
          const snap = await tx.get(roomRef);
          if (!snap.exists()) return;
          const room = snap.data() as RoomDoc | undefined;
          if (!room || room.status !== "clue") return;
          const proposalSource = room.order?.proposal;
          const proposal: (string | null)[] = Array.isArray(proposalSource)
            ? [...proposalSource]
            : [];
          if (proposal.length === 0) return;
          const filtered = proposal.filter(
            (id): id is string => typeof id === "string" && eligible.has(id)
          );
          if (filtered.length === proposal.length) return;
          traceAction("order.proposal.prune", {
            roomId,
            before: proposal.length,
            after: filtered.length,
          });
          tx.update(roomRef, {
            "order.proposal": filtered,
            lastActiveAt: serverTimestamp(),
          });
          tx.set(
            proposalRef,
            {
              proposal: filtered,
              seed: typeof room?.deal?.seed === "string" ? room.deal.seed : null,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        }),
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
} as const;
