import {
  addCardToProposal as addCardToProposalInternal,
  commitPlayFromClue as commitPlayFromClueInternal,
  dealNumbers as dealNumbersInternal,
  removeCardFromProposal as removeCardFromProposalInternal,
  startGame as startGameInternal,
  submitSortedOrder as submitSortedOrderInternal,
  finalizeReveal as finalizeRevealInternal,
} from "@/lib/game/room";
import {
  resetRoomWithPrune as resetRoomWithPruneInternal,
} from "@/lib/firebase/rooms";
import { topicControls } from "@/lib/game/topicControls";
import { db } from "@/lib/firebase/client";
import { bumpMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

export type ResetRoomKeepIds = Parameters<
  typeof resetRoomWithPruneInternal
>[1];
export type ResetRoomOptions = Parameters<
  typeof resetRoomWithPruneInternal
>[2];

export async function startGame(roomId: string) {
  traceAction("host.start", { roomId });
  try {
    return await startGameInternal(roomId);
  } catch (error) {
    traceError("host.start", error, { roomId });
    throw error;
  }
}

export async function dealNumbers(roomId: string) {
  traceAction("numbers.deal", { roomId });
  try {
    return await dealNumbersInternal(roomId);
  } catch (error) {
    traceError("numbers.deal", error, { roomId });
    throw error;
  }
}

export async function addCardToProposal(roomId: string, playerId: string) {
  traceAction("card.add", { roomId, playerId });
  try {
    return await addCardToProposalInternal(roomId, playerId);
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
    return await removeCardFromProposalInternal(roomId, playerId);
  } catch (error) {
    traceError("card.remove", error, { roomId, playerId });
    throw error;
  }
}

export async function commitPlayFromClue(roomId: string, playerId: string) {
  traceAction("clue.commit", { roomId, playerId });
  try {
    return await commitPlayFromClueInternal(roomId, playerId);
  } catch (error) {
    traceError("clue.commit", error, { roomId, playerId });
    throw error;
  }
}

export async function submitSortedOrder(roomId: string, list: string[]) {
  traceAction("order.submit", { roomId, size: list.length });
  try {
    return await submitSortedOrderInternal(roomId, list);
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
    keep: Array.isArray(keepIds) ? String(keepIds.length) : keepIds == null ? "0" : "custom",
  });
  try {
    return await resetRoomWithPruneInternal(roomId, keepIds, opts);
  } catch (error) {
    traceError("room.reset", error, {
      roomId,
      keep: Array.isArray(keepIds) ? String(keepIds.length) : keepIds == null ? "0" : "custom",
    });
    throw error;
  }
}

export async function finalizeReveal(roomId: string) {
  traceAction("reveal.finalize", { roomId });
  try {
    return await finalizeRevealInternal(roomId);
  } catch (error) {
    traceError("reveal.finalize", error, { roomId });
    throw error;
  }
}

// =============================
// UI Shared Gate: revealPending
// =============================
export async function beginRevealPending(roomId: string) {
  if (!db) return;
  const roomRef = doc(db, "rooms", roomId);
  try {
    traceAction("ui.revealPending.begin", { roomId });
    await setDoc(
      roomRef,
      {
        ui: {
          revealPending: true,
          revealBeginAt: serverTimestamp(),
        },
        lastActiveAt: serverTimestamp(),
      } as any,
      { merge: true }
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
    await updateDoc(roomRef, {
      "ui.revealPending": false,
      lastActiveAt: serverTimestamp(),
    } as any);
  } catch (error) {
    traceError("ui.revealPending.clear", error, { roomId });
    // 非致命: 失敗してもUIは自動解除されるため握りつぶす
  }
}

// clue中のみ、proposalから在室外IDを除去（冪等）。UI側の表示フィルタと合わせて二重で安全策。
export async function pruneProposalByEligible(
  roomId: string,
  eligibleIds: readonly string[]
) {
  if (!db) return;
  const roomRef = doc(db, "rooms", roomId);
  const eligible = new Set(eligibleIds);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(roomRef);
      if (!snap.exists()) return;
      const room: any = snap.data();
      if (room?.status !== "clue") return;
      const proposal: (string | null)[] = Array.isArray(room?.order?.proposal)
        ? (room.order.proposal as (string | null)[])
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
    });
  } catch (error) {
    traceError("order.proposal.prune", error, { roomId });
  }
}

export { topicControls };

export type SeatRequestSource = "manual" | "auto";

export async function requestSeat(
  roomId: string,
  uid: string,
  displayName?: string | null,
  source: SeatRequestSource = "manual"
) {
  const normalizedName =
    typeof displayName === "string" ? displayName.trim() : "";
  const cappedName =
    normalizedName.length > 32 ? normalizedName.slice(0, 32) : normalizedName;

  traceAction("spectator.requestSeat", { roomId, uid, source });

  // Spectator V3: recallOpen チェック
  const roomRef = doc(db!, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    throw new Error("部屋が見つかりません");
  }
  const room: any = roomSnap.data();
  const recallOpen = room?.ui?.recallOpen ?? false;
  const status = room?.status;

  if (status !== "waiting" || !recallOpen) {
    traceAction("spectator.requestSeat.blocked", { roomId, uid, status, recallOpen });
    throw new Error("現在は席に戻ることができません");
  }

  try {
    await setDoc(
      doc(db!, "rooms", roomId, "rejoinRequests", uid),
      {
        status: "pending",
        displayName: cappedName.length > 0 ? cappedName : null,
        source,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    bumpMetric("recall", "requested");
  } catch (error) {
    traceError("spectator.requestSeat", error, { roomId, uid, source });
    throw error;
  }
}

export async function cancelSeatRequest(roomId: string, uid: string) {
  traceAction("spectator.cancelSeatRequest", { roomId, uid });
  try {
    await deleteDoc(doc(db!, "rooms", roomId, "rejoinRequests", uid));
    bumpMetric("recall", "cancelled");
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
  requestSeat,
  cancelSeatRequest,
  pruneProposalByEligible,
  beginRevealPending,
  clearRevealPending,
} as const;
