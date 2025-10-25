import {
  addCardToProposal as addCardToProposalInternal,
  commitPlayFromClue as commitPlayFromClueInternal,
  dealNumbers as dealNumbersInternal,
  removeCardFromProposal as removeCardFromProposalInternal,
  startGame as startGameInternal,
  submitSortedOrder as submitSortedOrderInternal,
} from "@/lib/game/room";
import {
  resetRoomWithPrune as resetRoomWithPruneInternal,
} from "@/lib/firebase/rooms";
import { topicControls } from "@/lib/game/topicControls";

export type ResetRoomKeepIds = Parameters<
  typeof resetRoomWithPruneInternal
>[1];
export type ResetRoomOptions = Parameters<
  typeof resetRoomWithPruneInternal
>[2];

export async function startGame(roomId: string) {
  return startGameInternal(roomId);
}

export async function dealNumbers(roomId: string) {
  return dealNumbersInternal(roomId);
}

export async function addCardToProposal(roomId: string, playerId: string) {
  return addCardToProposalInternal(roomId, playerId);
}

export async function removeCardFromProposal(
  roomId: string,
  playerId: string
) {
  return removeCardFromProposalInternal(roomId, playerId);
}

export async function commitPlayFromClue(roomId: string, playerId: string) {
  return commitPlayFromClueInternal(roomId, playerId);
}

export async function submitSortedOrder(roomId: string, list: string[]) {
  return submitSortedOrderInternal(roomId, list);
}

export async function resetRoomWithPrune(
  roomId: string,
  keepIds: ResetRoomKeepIds,
  opts?: ResetRoomOptions
) {
  return resetRoomWithPruneInternal(roomId, keepIds, opts);
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
  topicControls,
} as const;

