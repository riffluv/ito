import { topicControls } from "@/lib/game/topicControls";
import { dealNumbers } from "@/lib/game/serviceParts/dealNumbers";
import { commitPlayFromClue } from "@/lib/game/serviceParts/clue";
import { submitSortedOrder } from "@/lib/game/serviceParts/order";
import { pruneProposalByEligible, addCardToProposal, removeCardFromProposal } from "@/lib/game/serviceParts/proposal";
import { resetRoomWithPrune } from "@/lib/game/serviceParts/reset";
import { beginRevealPending, clearRevealPending, finalizeReveal } from "@/lib/game/serviceParts/reveal";
import { setRoundPreparing } from "@/lib/game/serviceParts/roundPreparing";
import { startGame } from "@/lib/game/serviceParts/startGame";
import { cancelSeatRequest } from "@/lib/game/serviceParts/spectator";
export type { ResetRoomKeepIds, ResetRoomOptions, StartGameOptions } from "@/lib/game/serviceParts/types";
export { startGame };
export { dealNumbers };
export { addCardToProposal, removeCardFromProposal, pruneProposalByEligible };
export { commitPlayFromClue };
export { submitSortedOrder };
export { resetRoomWithPrune };
export { finalizeReveal, beginRevealPending, clearRevealPending };
export { setRoundPreparing };
export { cancelSeatRequest };
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
  cancelSeatRequest,
  pruneProposalByEligible,
  beginRevealPending,
  clearRevealPending,
  setRoundPreparing,
} as const;
