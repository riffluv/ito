import type { Firestore } from "firebase/firestore";

import { notify } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { setMetric } from "@/lib/utils/metrics";
import { traceError } from "@/lib/utils/trace";
import type { HostActionsController } from "@/lib/host/HostActionsController";
import type { RoundStageEvent } from "@/lib/hooks/useRoundTimeline";

import { scheduleResetSyncWatchdogs } from "@/lib/hooks/hostActions/scheduleResetSyncWatchdogs";

export async function runResetRoomToWaiting(params: {
  roomId: string;
  roundIds?: string[] | null;
  onlineUids?: string[] | null | undefined;
  includeOnline: boolean;
  recallSpectators: boolean;
  showFeedback: boolean;
  shouldPlaySound: boolean;
  canProceed: (action: string) => boolean;
  markActionStart: (action: string) => void;
  finalizeAction: (action: string, status: "success" | "error") => void;
  hostActions: HostActionsController;
  db?: Firestore | null;
  latestRoomStatusRef: { current: string | null | undefined };
  resetEarlySyncTimerRef: { current: number | null };
  resetStuckTimerRef: { current: number | null };
  resetOkAtRef: { current: number | null };
  latestStatusVersionRef: { current: number };
  expectedStatusVersionRef: { current: { reset: number | null } };
  beginResetUiHold: (durationMs: number) => void;
  clearResetUiHold: () => void;
  setIsResetting: (value: boolean) => void;
  playResetGame: () => void;
  onFeedback?: (payload: { message: string; tone: "info" | "success" } | null) => void;
  onStageEvent?: (event: RoundStageEvent) => void;
}): Promise<void> {
  const {
    roomId,
    roundIds,
    onlineUids,
    includeOnline,
    recallSpectators,
    showFeedback,
    shouldPlaySound,
    canProceed,
    markActionStart,
    finalizeAction,
    hostActions,
    db,
    latestRoomStatusRef,
    resetEarlySyncTimerRef,
    resetStuckTimerRef,
    resetOkAtRef,
    latestStatusVersionRef,
    expectedStatusVersionRef,
    beginResetUiHold,
    clearResetUiHold,
    setIsResetting,
    playResetGame,
    onFeedback,
    onStageEvent,
  } = params;

  markActionStart("reset");
  setIsResetting(true);
  if (!canProceed("reset")) {
    finalizeAction("reset", "error");
    setIsResetting(false);
    return;
  }

  beginResetUiHold(3400);
  onStageEvent?.("reset:start");
  if (shouldPlaySound) {
    playResetGame();
  }
  if (showFeedback) {
    onFeedback?.({ message: "リセット中…", tone: "info" });
  } else {
    onFeedback?.(null);
  }

  try {
    notify({
      id: toastIds.gameReset(roomId),
      title: "待機状態に戻しています…",
      type: "info",
      duration: 2000,
    });

    await hostActions.resetRoomToWaitingWithPrune({
      roomId,
      roundIds,
      onlineUids,
      includeOnline,
      recallSpectators,
    });

    if (typeof performance !== "undefined" && latestRoomStatusRef.current !== "waiting") {
      resetOkAtRef.current = performance.now();
      const expectedVersion = Math.max(0, latestStatusVersionRef.current + 1);
      expectedStatusVersionRef.current.reset = expectedVersion;
      setMetric("hostAction", "reset.expectedStatusVersion", expectedVersion);
      scheduleResetSyncWatchdogs({
        roomId,
        db,
        latestRoomStatusRef,
        resetEarlySyncTimerRef,
        resetStuckTimerRef,
      });
    }

    beginResetUiHold(2400);
    if (showFeedback) {
      onFeedback?.({
        message: "待機状態に戻しました！",
        tone: "success",
      });
    } else {
      onFeedback?.(null);
    }

    notify({
      id: toastIds.gameReset(roomId),
      title: "ゲームを待機状態に戻しました",
      type: "success",
      duration: 2000,
    });
    finalizeAction("reset", "success");
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    traceError("ui.room.reset", error, { roomId });
    const msg =
      error instanceof Error ? error.message : typeof error === "string" ? error : "";
    console.error("❌ resetGame: 失敗", error);

    if (code === "rate_limited") {
      notify({
        id: toastIds.genericInfo(roomId, "reset-rate-limited"),
        title: "リセット要求が立て込んでいます",
        description: "数秒待って自動的に再試行します。",
        type: "info",
        duration: 2000,
      });
    } else {
      notify({
        id: toastIds.genericError(roomId, "game-reset"),
        title: "リセットに失敗しました",
        description: msg,
        type: "error",
      });
    }
    onFeedback?.(null);
    finalizeAction("reset", "error");
    clearResetUiHold();
  } finally {
    setIsResetting(false);
    onStageEvent?.("reset:done");
  }
}

