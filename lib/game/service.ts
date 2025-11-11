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
    return await startGameInternal(roomId);
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
    return await dealNumbersInternal(roomId, 0, options);
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
    keep: Array.isArray(keepIds)
      ? String(keepIds.length)
      : keepIds === null || keepIds === undefined
        ? "0"
        : "custom",
  });
  try {
    return await resetRoomWithPruneInternal(roomId, keepIds, opts);
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
    return await finalizeRevealInternal(roomId);
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
    await setDoc(roomRef, payload, { merge: true });
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
    await updateDoc(roomRef, payload);
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
    });
  } catch (error) {
    traceError("order.proposal.prune", error, { roomId });
  }
}

export { topicControls };

export async function cancelSeatRequest(roomId: string, uid: string) {
  traceAction("spectator.cancelSeatRequest", { roomId, uid });
  try {
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
