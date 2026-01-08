import {
  isCustomModeSelectable,
  shouldShowCustomTopicPen,
  shouldShowNextGameButton,
  shouldShowWaitingHostStartPanel,
} from "@/components/ui/mini-hand-dock/miniHandDockUiFlags";

describe("miniHandDockUiFlags", () => {
  describe("isCustomModeSelectable", () => {
    it("returns true for explicit custom topicBox", () => {
      expect(
        isCustomModeSelectable({
          topicBox: "カスタム",
          effectiveDefaultTopicType: "通常版",
        })
      ).toBe(true);
    });

    it("returns true when default topic type is custom and topicBox is empty", () => {
      expect(
        isCustomModeSelectable({
          topicBox: null,
          effectiveDefaultTopicType: "カスタム",
        })
      ).toBe(true);
    });

    it("returns false otherwise", () => {
      expect(
        isCustomModeSelectable({
          topicBox: "通常版",
          effectiveDefaultTopicType: "カスタム",
        })
      ).toBe(false);
    });
  });

  describe("shouldShowWaitingHostStartPanel", () => {
    it("shows only in waiting when not preparing and host or claim active", () => {
      expect(
        shouldShowWaitingHostStartPanel({
          phaseStatus: "waiting",
          preparing: false,
          isHost: true,
          hostClaimActive: false,
        })
      ).toBe(true);

      expect(
        shouldShowWaitingHostStartPanel({
          phaseStatus: "waiting",
          preparing: false,
          isHost: false,
          hostClaimActive: true,
        })
      ).toBe(true);

      expect(
        shouldShowWaitingHostStartPanel({
          phaseStatus: "waiting",
          preparing: true,
          isHost: true,
          hostClaimActive: true,
        })
      ).toBe(false);

      expect(
        shouldShowWaitingHostStartPanel({
          phaseStatus: "clue",
          preparing: false,
          isHost: true,
          hostClaimActive: true,
        })
      ).toBe(false);
    });
  });

  describe("shouldShowNextGameButton", () => {
    it("shows for host in finished phase", () => {
      expect(
        shouldShowNextGameButton({
          phaseStatus: "finished",
          isHost: true,
          allowContinueAfterFail: false,
          autoStartLocked: false,
          isRestarting: false,
          isRevealAnimating: false,
        })
      ).toBe(true);
    });

    it("shows in reveal phase only when continue is allowed and not animating", () => {
      expect(
        shouldShowNextGameButton({
          phaseStatus: "reveal",
          isHost: true,
          allowContinueAfterFail: true,
          autoStartLocked: false,
          isRestarting: false,
          isRevealAnimating: false,
        })
      ).toBe(true);

      expect(
        shouldShowNextGameButton({
          phaseStatus: "reveal",
          isHost: true,
          allowContinueAfterFail: true,
          autoStartLocked: false,
          isRestarting: false,
          isRevealAnimating: true,
        })
      ).toBe(false);
    });

    it("returns false when not host or locked/restarting", () => {
      expect(
        shouldShowNextGameButton({
          phaseStatus: "finished",
          isHost: false,
          allowContinueAfterFail: true,
          autoStartLocked: false,
          isRestarting: false,
          isRevealAnimating: false,
        })
      ).toBe(false);

      expect(
        shouldShowNextGameButton({
          phaseStatus: "finished",
          isHost: true,
          allowContinueAfterFail: true,
          autoStartLocked: true,
          isRestarting: false,
          isRevealAnimating: false,
        })
      ).toBe(false);

      expect(
        shouldShowNextGameButton({
          phaseStatus: "finished",
          isHost: true,
          allowContinueAfterFail: true,
          autoStartLocked: false,
          isRestarting: true,
          isRevealAnimating: false,
        })
      ).toBe(false);
    });
  });

  describe("shouldShowCustomTopicPen", () => {
    it("shows only for non-host in custom selectable waiting/clue", () => {
      expect(
        shouldShowCustomTopicPen({
          phaseStatus: "waiting",
          isHost: false,
          isCustomModeSelectable: true,
        })
      ).toBe(true);

      expect(
        shouldShowCustomTopicPen({
          phaseStatus: "clue",
          isHost: false,
          isCustomModeSelectable: true,
        })
      ).toBe(true);

      expect(
        shouldShowCustomTopicPen({
          phaseStatus: "reveal",
          isHost: false,
          isCustomModeSelectable: true,
        })
      ).toBe(false);

      expect(
        shouldShowCustomTopicPen({
          phaseStatus: "waiting",
          isHost: true,
          isCustomModeSelectable: true,
        })
      ).toBe(false);
    });
  });
});

