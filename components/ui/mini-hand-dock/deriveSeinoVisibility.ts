export type DeriveSeinoVisibilityParams = {
  shouldShowSeinoButton: boolean;
  seinoTransitionBlocked: boolean;
  preparing: boolean;
  hideHandUI: boolean;
  isRevealAnimating: boolean;
};

export function deriveSeinoVisibility(params: DeriveSeinoVisibilityParams): boolean {
  const {
    shouldShowSeinoButton,
    seinoTransitionBlocked,
    preparing,
    hideHandUI,
    isRevealAnimating,
  } = params;

  return (
    shouldShowSeinoButton &&
    !seinoTransitionBlocked &&
    !preparing &&
    !hideHandUI &&
    !isRevealAnimating
  );
}

