export type DeriveQuickStartProgressParams = {
  showSpinner: boolean;
  spinnerText: string;
  quickStartPending: boolean;
  autoStartLocked: boolean;
  roundPreparing: boolean;
  isRestarting: boolean;
};

export function deriveQuickStartProgress(params: DeriveQuickStartProgressParams) {
  const {
    showSpinner,
    spinnerText,
    quickStartPending,
    autoStartLocked,
    roundPreparing,
    isRestarting,
  } = params;

  const showQuickStartProgress =
    showSpinner || quickStartPending || autoStartLocked || roundPreparing || isRestarting;

  const effectiveSpinnerText = showSpinner
    ? spinnerText
    : roundPreparing
      ? "次のラウンドを準備しています…"
      : quickStartPending || isRestarting
        ? "状態を同期しています…"
        : spinnerText;

  return { showQuickStartProgress, effectiveSpinnerText };
}

