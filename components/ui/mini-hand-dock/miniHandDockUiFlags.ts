export function isCustomModeSelectable(params: {
  topicBox: string | null | undefined;
  effectiveDefaultTopicType: string | null | undefined;
}): boolean {
  const { topicBox, effectiveDefaultTopicType } = params;
  return (
    topicBox === "カスタム" ||
    (!topicBox && effectiveDefaultTopicType === "カスタム")
  );
}

export function shouldShowWaitingHostStartPanel(params: {
  phaseStatus: string | null | undefined;
  preparing: boolean;
  isHost: boolean;
  hostClaimActive: boolean;
}): boolean {
  const { phaseStatus, preparing, isHost, hostClaimActive } = params;
  return phaseStatus === "waiting" && !preparing && (isHost || hostClaimActive);
}

export function shouldShowNextGameButton(params: {
  phaseStatus: string | null | undefined;
  isHost: boolean;
  allowContinueAfterFail: boolean;
  autoStartLocked: boolean;
  isRestarting: boolean;
  isRevealAnimating: boolean;
}): boolean {
  const {
    phaseStatus,
    isHost,
    allowContinueAfterFail,
    autoStartLocked,
    isRestarting,
    isRevealAnimating,
  } = params;

  if (!isHost) return false;
  if (autoStartLocked) return false;
  if (isRestarting) return false;

  const canShowInReveal = phaseStatus === "reveal" && allowContinueAfterFail;
  const canShowInFinished = phaseStatus === "finished";
  const phaseAllowed = canShowInReveal || canShowInFinished;
  if (!phaseAllowed) return false;
  if (phaseStatus === "reveal" && isRevealAnimating) return false;

  return true;
}

export function shouldShowCustomTopicPen(params: {
  phaseStatus: string | null | undefined;
  isHost: boolean;
  isCustomModeSelectable: boolean;
}): boolean {
  const { phaseStatus, isHost, isCustomModeSelectable } = params;
  if (isHost) return false;
  if (!isCustomModeSelectable) return false;
  return phaseStatus === "waiting" || phaseStatus === "clue";
}

