import { deriveQuickStartProgress } from "@/components/ui/mini-hand-dock/deriveQuickStartProgress";

describe("deriveQuickStartProgress", () => {
  it("shows the indicator when any progress flag is active", () => {
    const result = deriveQuickStartProgress({
      showSpinner: false,
      spinnerText: "X",
      quickStartPending: false,
      autoStartLocked: false,
      roundPreparing: true,
      isRestarting: false,
    });

    expect(result.showQuickStartProgress).toBe(true);
  });

  it("prefers spinnerText while showSpinner is true", () => {
    const result = deriveQuickStartProgress({
      showSpinner: true,
      spinnerText: "読み込み中",
      quickStartPending: true,
      autoStartLocked: true,
      roundPreparing: true,
      isRestarting: true,
    });

    expect(result.effectiveSpinnerText).toBe("読み込み中");
  });

  it("uses roundPreparing message when applicable", () => {
    const result = deriveQuickStartProgress({
      showSpinner: false,
      spinnerText: "X",
      quickStartPending: false,
      autoStartLocked: false,
      roundPreparing: true,
      isRestarting: false,
    });

    expect(result.effectiveSpinnerText).toBe("次のラウンドを準備しています…");
  });

  it("uses syncing message for quickStartPending or restarting", () => {
    const result = deriveQuickStartProgress({
      showSpinner: false,
      spinnerText: "X",
      quickStartPending: true,
      autoStartLocked: false,
      roundPreparing: false,
      isRestarting: false,
    });

    expect(result.effectiveSpinnerText).toBe("状態を同期しています…");
  });
});

