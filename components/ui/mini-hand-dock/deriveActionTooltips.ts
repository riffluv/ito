"use client";

export type DeriveActionTooltipsParams = {
  preparing: boolean;
  clueEditable: boolean;
  placed: boolean;
  hasText: boolean;
  displayHasText: boolean;
  ready: boolean;
  isSortMode: boolean;
  canClickProposalButton: boolean;
  playerId: string | null;
  playerNumber: number | null;
};

export function deriveActionTooltips(params: DeriveActionTooltipsParams) {
  const {
    preparing,
    clueEditable,
    placed,
    hasText,
    displayHasText,
    ready,
    isSortMode,
    canClickProposalButton,
    playerId,
    playerNumber,
  } = params;

  const baseActionTooltip =
    isSortMode && placed ? "カードを待機エリアに戻す" : "カードを場に出す";

  const clearButtonDisabled = preparing || !clueEditable || !hasText || placed;
  const clearTooltip = preparing
    ? "準備中は操作できません"
    : !clueEditable
      ? "判定中は操作できません"
      : placed
        ? "カード提出中は操作できません"
        : !displayHasText
          ? "連想ワードが入力されていません"
          : "連想ワードをクリア";

  const decideTooltip = preparing
    ? "準備中は操作できません"
    : !clueEditable
      ? "判定中は操作できません"
      : !displayHasText
        ? "連想ワードを入力してください"
        : "連想ワードを決定";

  const submitDisabledReason = preparing
    ? "準備中は操作できません"
    : !clueEditable
      ? "このタイミングではカードを出せません"
      : !playerId
        ? "参加処理が終わるまで待ってください"
        : typeof playerNumber !== "number"
          ? "番号が配られるまで待ってください"
          : !displayHasText
            ? "連想ワードを入力するとカードを出せます"
            : !ready
              ? "「決定」を押すとカードを出せます"
              : "カードを場に出せません";

  const effectiveCanClickProposalButton = !preparing && canClickProposalButton;
  const submitTooltip = effectiveCanClickProposalButton
    ? baseActionTooltip
    : submitDisabledReason;

  return {
    clearButtonDisabled,
    clearTooltip,
    decideTooltip,
    submitTooltip,
    effectiveCanClickProposalButton,
  };
}

