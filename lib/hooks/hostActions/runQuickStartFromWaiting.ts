import type { Firestore } from "firebase/firestore";

import { notify, muteNotifications } from "@/components/ui/notify";
import type { RoundStageEvent } from "@/lib/hooks/useRoundTimeline";
import { handleQuickStartFailure } from "@/lib/hooks/hostActions/handleQuickStartFailure";
import { runQuickStartWithNotWaitingRetry } from "@/lib/hooks/hostActions/runQuickStartWithNotWaitingRetry";
import { scheduleQuickStartSyncWatchdogs } from "@/lib/hooks/hostActions/scheduleQuickStartSyncWatchdogs";
import type { HostActionsController } from "@/lib/host/HostActionsController";
import type { ShowtimeIntentHandlers, ShowtimeIntentMetadata } from "@/lib/showtime/types";
import { toastIds } from "@/lib/ui/toastIds";
import { handleFirebaseQuotaError, isFirebaseQuotaExceeded } from "@/lib/utils/errorHandling";
import { setMetric } from "@/lib/utils/metrics";
import { calculateEffectiveActive } from "@/lib/utils/playerCount";
import { traceAction } from "@/lib/utils/trace";
import { getAuth } from "firebase/auth";

type QuickStartOptions = {
  broadcast?: boolean;
  playSound?: boolean;
  markShowtimeStart?: boolean;
  intentMeta?: ShowtimeIntentMetadata;
};

export async function runQuickStartFromWaiting(params: {
  roomId: string;
  roomStatus?: string;
  resetUiPending: boolean;
  clearResetUiHold: () => void;
  options?: QuickStartOptions;
  quickStartPending: boolean;
  canProceed: (action: string) => boolean;
  isResetting: boolean;
  isHost: boolean;
  playerCount?: number;
  presenceReady: boolean;
  presenceCanStart: boolean;
  ensurePresenceReady: () => boolean;
  onlineUids?: string[] | null | undefined;
  currentTopic?: string | null;
  effectiveDefaultTopicType: string;
  beginAutoStartLock: (
    duration: number,
    options?: { broadcast?: boolean; delayMs?: number }
  ) => void;
  clearAutoStartLock: () => void;
  playOrderConfirm: () => void;
  showtimeIntents?: ShowtimeIntentHandlers;
  markActionStart: (action: string) => void;
  finalizeAction: (action: string, status: "success" | "error") => void;
  abortAction: (action: string) => void;
  setQuickStartPending: (pending: boolean) => void;
  hostActions: HostActionsController;
  roundIds?: string[] | null;
  setCustomStartPending: (pending: boolean) => void;
  setCustomText: (value: string) => void;
  setCustomOpen: (open: boolean) => void;
  latestRoomStatusRef: { current: string | null | undefined };
  quickStartOkAtRef: { current: number | null };
  latestStatusVersionRef: { current: number };
  expectedStatusVersionRef: { current: { quickStart: number | null } };
  quickStartEarlySyncTimerRef: { current: number | null };
  quickStartStuckTimerRef: { current: number | null };
  db?: Firestore | null;
  onStageEvent?: (event: RoundStageEvent) => void;
}): Promise<boolean> {
  const {
    roomId,
    roomStatus,
    resetUiPending,
    clearResetUiHold,
    options,
    quickStartPending,
    canProceed,
    isResetting,
    isHost,
    playerCount,
    presenceReady,
    presenceCanStart,
    ensurePresenceReady,
    onlineUids,
    currentTopic,
    effectiveDefaultTopicType,
    beginAutoStartLock,
    clearAutoStartLock,
    playOrderConfirm,
    showtimeIntents,
    markActionStart,
    finalizeAction,
    abortAction,
    setQuickStartPending,
    hostActions,
    roundIds,
    setCustomStartPending,
    setCustomText,
    setCustomOpen,
    latestRoomStatusRef,
    quickStartOkAtRef,
    latestStatusVersionRef,
    expectedStatusVersionRef,
    quickStartEarlySyncTimerRef,
    quickStartStuckTimerRef,
    db,
    onStageEvent,
  } = params;

  // If the host starts right after a reset, clear the optimistic reset UI hold.
  // Otherwise, `resetUiPending` can keep the UI in a "waiting" state even after
  // the room transitions to "clue", causing the start panel to briefly reappear.
  if (resetUiPending) {
    clearResetUiHold();
  }

  if (quickStartPending) return false;
  if (!canProceed("quickStart")) return false;
  if (isResetting) return false;

  if (!isHost) {
    traceAction("ui.host.quickStart.blocked", {
      roomId,
      reason: "not-host",
    });
    notify({
      id: toastIds.genericInfo(roomId, "host-claim-wait"),
      title: "ホスト権限を確認しています",
      description: "権限の譲渡が完了するまで数秒お待ちください",
      type: "info",
      duration: 2600,
    });
    return false;
  }

  const isRestartIntent =
    options?.intentMeta?.action &&
    typeof options.intentMeta.action === "string" &&
    options.intentMeta.action.startsWith("quickStart:restart");
  const effectiveRoomStatusForStart = resetUiPending ? "waiting" : roomStatus;
  if (
    effectiveRoomStatusForStart &&
    effectiveRoomStatusForStart !== "waiting" &&
    !isRestartIntent
  ) {
    notify({
      id: toastIds.genericInfo(roomId, "status-mismatch"),
      title: "ゲームを開始できません",
      description: "進行中です。リセット後にもう一度試してください。",
      type: "warning",
      duration: 2600,
    });
    return false;
  }

  const basePlayerCountRaw =
    typeof playerCount === "number" && Number.isFinite(playerCount)
      ? Math.max(0, playerCount)
      : 0;
  // 初期同期遅延で playerCount が 0 になりがちなため、ホスト自身がいれば 1 人として扱い警告だけ出す
  const basePlayerCount = basePlayerCountRaw === 0 ? 1 : basePlayerCountRaw;
  if (basePlayerCountRaw === 0) {
    notify({
      id: toastIds.numberDealWarningPlayers(roomId),
      title: "プレイヤー数を確認しています…",
      description: "ホストのみ検出中ですが、そのまま開始します。",
      type: "info",
      duration: 2000,
    });
  }

  const onlineCount =
    presenceReady && Array.isArray(onlineUids)
      ? onlineUids.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
          .length
      : undefined;
  const activeCount = calculateEffectiveActive(onlineCount, basePlayerCount, { maxDrift: 3 });
  const shouldSkipPresenceCheck = activeCount <= 2;
  if (activeCount < 2 && basePlayerCount < 2) {
    traceAction("ui.host.quickStart.warning", {
      roomId,
      reason: "insufficient-players",
      active: String(activeCount),
      players: String(basePlayerCount),
      online: String(onlineCount ?? -1),
    });
    notify({
      id: toastIds.numberDealWarningPlayers(roomId),
      title: "プレイヤーが1人のままです",
      description: "デバッグ用途であれば、このまま開始できます。",
      type: "info",
      duration: 2600,
    });
  }
  if (!shouldSkipPresenceCheck && !ensurePresenceReady()) {
    return false;
  }

  markActionStart("quickStart");
  setQuickStartPending(true);
  onStageEvent?.("round:prepare");
  notify({
    id: toastIds.genericInfo(roomId, "quickstart-pending"),
    title: "ゲーム開始の準備中…",
    description: "カードとお題を揃えています",
    type: "info",
    duration: 1800,
  });

  if (options?.markShowtimeStart ?? true) {
    showtimeIntents?.markStartIntent?.({
      action: options?.intentMeta?.action ?? "quickStart",
      source: options?.intentMeta?.source ?? "useHostActions",
    });
  }

  beginAutoStartLock(2600, {
    broadcast: options?.broadcast ?? true,
    delayMs: 80,
  });

  let success = false;
  try {
    if (options?.playSound ?? true) {
      playOrderConfirm();
    }

    muteNotifications(
      [
        toastIds.topicChangeSuccess(roomId),
        toastIds.topicShuffleSuccess(roomId),
        toastIds.numberDealSuccess(roomId),
        toastIds.gameReset(roomId),
      ],
      2800
    );

    // restart intent（次のゲーム）の場合は最初から allowFromFinished: true で呼び出す
    // これにより reset の Firestore 伝播を待たずに reveal/finished → clue に直接遷移できる
    const isRestartFlow = !!isRestartIntent;
    const { result, attempts } = await runQuickStartWithNotWaitingRetry({
      hostActions,
      roomId,
      roomStatus,
      defaultTopicType: effectiveDefaultTopicType,
      presenceReady: presenceCanStart,
      onlineUids,
      playerCount: basePlayerCount,
      currentTopic,
      isRestartFlow,
      roundIds,
    });

    traceAction("ui.host.quickStart.result", {
      roomId,
      ok: result.ok ? "1" : "0",
      requestId: result.requestId,
      reason: result.ok ? "ok" : result.reason,
      status: result.ok ? undefined : String(result.status ?? -1),
      errorCode: result.ok ? undefined : result.errorCode ?? undefined,
      attempts: String(attempts),
    });
    setMetric(
      "hostAction",
      "quickStart.lastResult",
      result.ok
        ? `ok:${result.requestId}`
        : `fail:${result.reason}:${result.status ?? "-"}:${result.errorCode ?? "-"}:${result.requestId}`
    );

    if (!result.ok) {
      handleQuickStartFailure({
        roomId,
        roomStatus,
        result,
        attempts,
        ensurePresenceReady: () => void ensurePresenceReady(),
        setCustomStartPending,
        setCustomText,
        setCustomOpen,
      });
      abortAction("quickStart");
      return false;
    }

    notify({
      id: toastIds.gameStart(roomId),
      title: "お題とカードを配布しました！",
      description:
        result.durationMs && result.durationMs > 2000
          ? "時間がかかっています。通信状態をご確認ください"
          : undefined,
      type: "success",
      duration: 2000,
    });

    success = true;
    onStageEvent?.("round:start");
    onStageEvent?.("round:end");

    if (typeof window !== "undefined") {
      if (typeof performance !== "undefined" && latestRoomStatusRef.current !== "clue") {
        quickStartOkAtRef.current = performance.now();
        const expectedVersion = Math.max(0, latestStatusVersionRef.current + 1);
        expectedStatusVersionRef.current.quickStart = expectedVersion;
        setMetric("hostAction", "quickStart.expectedStatusVersion", expectedVersion);
      }
      scheduleQuickStartSyncWatchdogs({
        roomId,
        requestId: result.requestId,
        db,
        latestRoomStatusRef,
        quickStartEarlySyncTimerRef,
        quickStartStuckTimerRef,
      });
    }

    return true;
  } catch (error) {
    clearAutoStartLock();
    const auth = getAuth();
    const originalUid = auth?.currentUser?.uid;
    const shouldAbort =
      typeof options?.intentMeta === "object" &&
      options?.intentMeta !== null &&
      "shouldAbort" in options.intentMeta &&
      typeof (options.intentMeta as { shouldAbort?: unknown }).shouldAbort === "function"
        ? (options.intentMeta as {
            shouldAbort?: (err: unknown) => boolean;
          }).shouldAbort?.(error) ?? false
        : false;
    if (shouldAbort) {
      traceAction("ui.host.quickStart.abort", {
        roomId,
        reason: "intent-abort",
      });
      notify({
        id: toastIds.genericInfo(roomId, "quickstart-abort"),
        title: "ホスト権限が更新されました",
        description: "再接続後に再試行してください",
        type: "warning",
      });
      abortAction("quickStart");
      return false;
    }
    if (originalUid && originalUid !== auth?.currentUser?.uid) {
      traceAction("ui.host.quickStart.abort", {
        roomId,
        reason: "auth-changed",
      });
      notify({
        id: toastIds.genericInfo(roomId, "quickstart-auth-change"),
        title: "サインイン状態を再確認してください",
        description: "ブラウザの再読み込み後に再試行してください",
        type: "warning",
      });
      abortAction("quickStart");
      return false;
    }
    if (isFirebaseQuotaExceeded(error)) {
      handleFirebaseQuotaError("ゲーム開始");
    } else {
      const message = error instanceof Error ? error.message : "処理に失敗しました";
      notify({
        id: toastIds.gameStartError(roomId),
        title: "ゲーム開始に失敗しました",
        description: message,
        type: "error",
      });
    }
    return false;
  } finally {
    if (!success || latestRoomStatusRef.current === "clue") {
      setQuickStartPending(false);
    }
    if (!success) {
      onStageEvent?.("round:abort");
    }
    finalizeAction("quickStart", success ? "success" : "error");
  }
}
