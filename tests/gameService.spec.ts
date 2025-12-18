import { expect, test } from "@playwright/test";
import {
  GameService,
  submitSortedOrder,
  startGame,
  dealNumbers,
  addCardToProposal,
  removeCardFromProposal,
  commitPlayFromClue,
  resetRoomWithPrune,
  finalizeReveal,
  topicControls,
} from "../lib/game/service";
import { topicControls as topicControlsOriginal } from "../lib/game/topicControls";

test.describe("GameService exports", () => {
  test("GameService exposes named exports", () => {
    expect(GameService.startGame).toBe(startGame);
    expect(GameService.dealNumbers).toBe(dealNumbers);
    expect(GameService.addCardToProposal).toBe(addCardToProposal);
    expect(GameService.removeCardFromProposal).toBe(removeCardFromProposal);
    expect(GameService.commitPlayFromClue).toBe(commitPlayFromClue);
    expect(GameService.submitSortedOrder).toBe(submitSortedOrder);
    expect(GameService.resetRoomWithPrune).toBe(resetRoomWithPrune);
    expect(GameService.finalizeReveal).toBe(finalizeReveal);
  });

  test("topicControls re-exports the original object", () => {
    expect(topicControls).toBe(topicControlsOriginal);
    expect(GameService.topicControls).toBe(topicControlsOriginal);
  });
});
