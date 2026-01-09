import { notify } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { traceAction, traceError } from "@/lib/utils/trace";
import type { ShowtimeIntentHandlers } from "@/lib/showtime/types";
import type { HostActionsController } from "@/lib/host/HostActionsController";

import { handleCustomTopicSubmissionResult } from "@/lib/hooks/hostActions/handleCustomTopicSubmissionResult";

export async function runSubmitCustomTopicAndMaybeStart(params: {
  roomId: string;
  value: string;
  isHost: boolean;
  roomStatus?: string;
  customStartPending: boolean;
  actualResolveMode: "sort-submit";
  hostActions: HostActionsController;
  presenceCanStart: boolean;
  onlineUids?: string[] | null | undefined;
  playerCount?: number;
  ensurePresenceReady: () => void;
  setCustomOpen: (open: boolean) => void;
  setCustomStartPending: (pending: boolean) => void;
  showtimeIntents?: ShowtimeIntentHandlers;
  playOrderConfirm: () => void;
}): Promise<void> {
  const {
    roomId,
    value,
    isHost,
    roomStatus,
    customStartPending,
    actualResolveMode,
    hostActions,
    presenceCanStart,
    onlineUids,
    playerCount,
    ensurePresenceReady,
    setCustomOpen,
    setCustomStartPending,
    showtimeIntents,
    playOrderConfirm,
  } = params;

  const trimmed = (value || "").trim();
  if (!trimmed) return;

  traceAction("ui.topic.customSubmit", {
    roomId,
    isHost: isHost ? "1" : "0",
  });

  const shouldAutoStart =
    isHost &&
    (roomStatus === "waiting" || customStartPending) &&
    actualResolveMode === "sort-submit";

  try {
    const result = await hostActions.submitCustomTopicAndStartIfNeeded({
      roomId,
      roomStatus,
      defaultTopicType: "カスタム",
      customTopic: trimmed,
      currentTopic: trimmed,
      presenceInfo: {
        presenceReady: presenceCanStart,
        onlineUids,
        playerCount,
      },
      shouldAutoStart,
    });
    setCustomOpen(false);

    const shouldProceed = handleCustomTopicSubmissionResult({
      roomId,
      shouldAutoStart,
      result,
      ensurePresenceReady,
    });
    if (!shouldProceed) return;

    showtimeIntents?.markStartIntent?.({
      action: "quickStart:customTopic",
      source: "useHostActions",
    });
    playOrderConfirm();
    notify({
      id: toastIds.gameStart(roomId),
      title: "カスタムお題で開始",
      type: "success",
      duration: 2000,
    });
  } catch (error) {
    traceError("ui.topic.customSubmit", error, {
      roomId,
      stage: "setTopic",
    });
    throw error;
  } finally {
    setCustomStartPending(false);
  }
}

