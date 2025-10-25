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
import { traceAction, traceError } from "@/lib/utils/trace";

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
} as const;
