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
} as const;
