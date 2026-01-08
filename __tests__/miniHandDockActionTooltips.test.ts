import { deriveActionTooltips } from "@/components/ui/mini-hand-dock/deriveActionTooltips";

describe("deriveActionTooltips", () => {
  it("prioritizes preparing state across tooltips", () => {
    const result = deriveActionTooltips({
      preparing: true,
      clueEditable: true,
      placed: false,
      hasText: true,
      displayHasText: true,
      ready: true,
      isSortMode: true,
      canClickProposalButton: true,
      playerId: "me",
      playerNumber: 10,
    });

    expect(result.clearButtonDisabled).toBe(true);
    expect(result.clearTooltip).toBe("準備中は操作できません");
    expect(result.decideTooltip).toBe("準備中は操作できません");
    expect(result.submitTooltip).toBe("準備中は操作できません");
    expect(result.effectiveCanClickProposalButton).toBe(false);
  });

  it("uses baseActionTooltip when the proposal button is clickable", () => {
    const result = deriveActionTooltips({
      preparing: false,
      clueEditable: true,
      placed: false,
      hasText: true,
      displayHasText: true,
      ready: true,
      isSortMode: true,
      canClickProposalButton: true,
      playerId: "me",
      playerNumber: 10,
    });

    expect(result.effectiveCanClickProposalButton).toBe(true);
    expect(result.submitTooltip).toBe("カードを場に出す");
  });

  it("returns a helpful reason when the clue is not decided yet", () => {
    const result = deriveActionTooltips({
      preparing: false,
      clueEditable: true,
      placed: false,
      hasText: true,
      displayHasText: true,
      ready: false,
      isSortMode: true,
      canClickProposalButton: false,
      playerId: "me",
      playerNumber: 10,
    });

    expect(result.effectiveCanClickProposalButton).toBe(false);
    expect(result.submitTooltip).toBe("「決定」を押すとカードを出せます");
  });
});

