import { deriveSeinoVisibility } from "@/components/ui/mini-hand-dock/deriveSeinoVisibility";

describe("deriveSeinoVisibility", () => {
  it("returns true only when all guards are satisfied", () => {
    expect(
      deriveSeinoVisibility({
        shouldShowSeinoButton: true,
        seinoTransitionBlocked: false,
        preparing: false,
        hideHandUI: false,
        isRevealAnimating: false,
      })
    ).toBe(true);
  });

  it("returns false when the transition is blocked", () => {
    expect(
      deriveSeinoVisibility({
        shouldShowSeinoButton: true,
        seinoTransitionBlocked: true,
        preparing: false,
        hideHandUI: false,
        isRevealAnimating: false,
      })
    ).toBe(false);
  });

  it("returns false while preparing", () => {
    expect(
      deriveSeinoVisibility({
        shouldShowSeinoButton: true,
        seinoTransitionBlocked: false,
        preparing: true,
        hideHandUI: false,
        isRevealAnimating: false,
      })
    ).toBe(false);
  });
});

