import { db } from "@/lib/firebase/client";
import { useHostActionsRuntime } from "@/lib/hooks/hostActions/useHostActionsRuntime";
import { runQuickStartFromWaiting } from "@/lib/hooks/hostActions/runQuickStartFromWaiting";
import { runNextGameWithNextRoundApi } from "@/lib/hooks/hostActions/runNextGameWithNextRoundApi";
import { runEvalSortedSubmit } from "@/lib/hooks/hostActions/runEvalSortedSubmit";
import { runSubmitCustomTopicAndMaybeStart } from "@/lib/hooks/hostActions/runSubmitCustomTopicAndMaybeStart";
import { runResetRoomToWaiting } from "@/lib/hooks/hostActions/runResetRoomToWaiting";
import { runRestartGame } from "@/lib/hooks/hostActions/runRestartGame";
import { closeCustomTopic as closeCustomTopicHelper } from "@/lib/hooks/hostActions/closeCustomTopic";
import { recordHostUiIntent } from "@/lib/hooks/hostActions/recordHostUiIntent";
import type {
  QuickStartOptions,
  ResetOptions,
  UseHostActionsOptions,
} from "@/lib/hooks/hostActions/types";
import { useHostActionsLocalState } from "@/lib/hooks/hostActions/useHostActionsLocalState";
import { useCallback, useMemo } from "react";

export function useHostActions({
  roomId,
  roomStatus,
  statusVersion,
  isHost,
  isRevealAnimating,
  autoStartLocked,
  beginAutoStartLock,
  clearAutoStartLock,
  actualResolveMode,
  defaultTopicType,
  roundIds,
  onlineUids,
  proposal,
  currentTopic,
  onFeedback,
  presenceReady = false,
  presenceDegraded = false,
  playerCount,
  showtimeIntents,
  onStageEvent,
}: UseHostActionsOptions) {
  const {
    quickStartPending,
    setQuickStartPending,
    isResetting,
    setIsResetting,
    isRestarting,
    setIsRestarting,
    customOpen,
    setCustomOpen,
    customStartPending,
    setCustomStartPending,
    customText,
    setCustomText,
    evalSortedPending,
    setEvalSortedPending,
    evalSortedPendingRef,
  } = useHostActionsLocalState();
  const runtime = useHostActionsRuntime({
    roomId,
    roomStatus,
    statusVersion,
    quickStartPending,
    isRestarting,
    setQuickStartPending,
    setIsRestarting,
    presenceReady,
    presenceDegraded,
    playerCount,
  });

  const effectiveDefaultTopicType = useMemo(() => {
    if (defaultTopicType && typeof defaultTopicType === "string") {
      return defaultTopicType;
    }
    return "通常版";
  }, [defaultTopicType]);

  const {
    hostActions,
    mountedRef,
    lastActionAtRef,
    latestRoomStatusRef,
    latestStatusVersionRef,
    expectedStatusVersionRef,
    quickStartStuckTimerRef,
    quickStartEarlySyncTimerRef,
    quickStartOkAtRef,
    nextGameStuckTimerRef,
    nextGameEarlySyncTimerRef,
    nextGameOkAtRef,
    resetOkAtRef,
    resetStuckTimerRef,
    resetEarlySyncTimerRef,
    canProceed,
    markActionStart,
    finalizeAction,
    abortAction,
    playOrderConfirm,
    playResetGame,
    presenceForceEligible,
    presenceCanStart,
    presenceWaitRemainingMs,
    ensurePresenceReady,
    resetUiPending,
    beginResetUiHold,
    clearResetUiHold,
  } = runtime;

  // NOTE: resetUiHold のタイマー管理は useResetUiHold 側で完結させる

  const quickStart = useCallback(
    async (options?: QuickStartOptions) => {
      if (typeof performance !== "undefined") {
        recordHostUiIntent({
          roomId,
          intent: "quickStart",
          startedAt: performance.now(),
          clickMetricKey: "ui.quickStart.clicks",
          nextPaintMetricKey: "ui.quickStart.nextPaintMs",
        });
      }
      return await runQuickStartFromWaiting({
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
      });
    },
    [
      quickStartPending,
      effectiveDefaultTopicType,
      beginAutoStartLock,
      clearAutoStartLock,
      playOrderConfirm,
      roomId,
      latestRoomStatusRef,
      quickStartOkAtRef,
      latestStatusVersionRef,
      expectedStatusVersionRef,
      quickStartEarlySyncTimerRef,
      quickStartStuckTimerRef,
      ensurePresenceReady,
      currentTopic,
      playerCount,
      presenceReady,
      presenceCanStart,
      onlineUids,
      showtimeIntents,
      abortAction,
      markActionStart,
      isHost,
      isResetting,
      finalizeAction,
      hostActions,
      roomStatus,
      clearResetUiHold,
      resetUiPending,
      roundIds,
      setQuickStartPending,
      setCustomOpen,
      setCustomStartPending,
      setCustomText,
      onStageEvent,
      canProceed,
    ]
  );

  const resetGame = useCallback(
    async (options?: ResetOptions) => {
      if (typeof performance !== "undefined") {
        recordHostUiIntent({
          roomId,
          intent: "reset",
          startedAt: performance.now(),
          clickMetricKey: "ui.reset.clicks",
          nextPaintMetricKey: "ui.reset.nextPaintMs",
        });
      }
      const showFeedback = options?.showFeedback ?? true;
      const shouldPlaySound = options?.playSound ?? true;
      const includeOnline = options?.includeOnline ?? true;
      const recallSpectators = options?.recallSpectators ?? true;
      await runResetRoomToWaiting({
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
      });
    },
    [
      roomId,
      onFeedback,
      playResetGame,
      roundIds,
      onlineUids,
      latestRoomStatusRef,
      resetEarlySyncTimerRef,
      resetStuckTimerRef,
      resetOkAtRef,
      latestStatusVersionRef,
      expectedStatusVersionRef,
      markActionStart,
      finalizeAction,
      hostActions,
      onStageEvent,
      beginResetUiHold,
      clearResetUiHold,
      setIsResetting,
      canProceed,
    ]
  );

  const restartGame = useCallback(
    async (opts?: { playSound?: boolean }) => {
      const playSound = opts?.playSound ?? true;
      return await runRestartGame({
        roomId,
        playSound,
        resetGame,
        quickStart,
      });
    },
    [resetGame, quickStart, roomId]
  );

  // ============================================================================
  // handleNextGame: 新しい nextRound API を使用
  // ============================================================================
  // 従来の restartGame (= resetGame + quickStart) を置き換え。
  // 単一の API 呼び出しで reset + start + topic選択 + deal をアトミックに実行。
  // ============================================================================
  const handleNextGame = useCallback(async () => {
    if (typeof performance !== "undefined") {
      recordHostUiIntent({
        roomId,
        intent: "nextGame",
        startedAt: performance.now(),
        clickMetricKey: "ui.nextGame.clicks",
        nextPaintMetricKey: "ui.nextGame.nextPaintMs",
      });
    }
    await runNextGameWithNextRoundApi({
      roomId,
      roomStatus,
      isHost,
      isRevealAnimating,
      autoStartLocked,
      quickStartPending,
      isRestarting,
      defaultTopicType,
      currentTopic,
      presenceReady,
      onlineUids,
      playerCount,
      hostActions,
      db,
      latestRoomStatusRef,
      nextGameEarlySyncTimerRef,
      nextGameStuckTimerRef,
      nextGameOkAtRef,
      latestStatusVersionRef,
      expectedStatusVersionRef,
      lastActionAtRef,
      setIsRestarting,
      onStageEvent,
      beginAutoStartLock,
      clearAutoStartLock,
      playOrderConfirm,
      markActionStart,
      finalizeAction,
    });
  }, [
    roomId,
    roomStatus,
    isHost,
    isRevealAnimating,
    autoStartLocked,
    quickStartPending,
    isRestarting,
    defaultTopicType,
    currentTopic,
    presenceReady,
    onlineUids,
    playerCount,
    hostActions,
    latestRoomStatusRef,
    nextGameEarlySyncTimerRef,
    nextGameStuckTimerRef,
    nextGameOkAtRef,
    latestStatusVersionRef,
    expectedStatusVersionRef,
    lastActionAtRef,
    onStageEvent,
    beginAutoStartLock,
    clearAutoStartLock,
    playOrderConfirm,
    markActionStart,
    finalizeAction,
    setIsRestarting,
  ]);

  const evalSorted = useCallback(async (): Promise<boolean> => {
    return await runEvalSortedSubmit({
      roomId,
      proposal,
      hostActions,
      showtimeIntents,
      playOrderConfirm,
      evalSortedPendingRef,
      mountedRef,
      setEvalSortedPending,
    });
  }, [
    proposal,
    playOrderConfirm,
    roomId,
    showtimeIntents,
    hostActions,
    mountedRef,
    evalSortedPendingRef,
    setEvalSortedPending,
  ]);

  const handleSubmitCustom = useCallback(
    async (value: string) => {
      await runSubmitCustomTopicAndMaybeStart({
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
        ensurePresenceReady: () => void ensurePresenceReady(),
        setCustomOpen,
        setCustomStartPending,
        showtimeIntents,
        playOrderConfirm,
      });
    },
    [
      roomId,
      isHost,
      roomStatus,
      customStartPending,
      actualResolveMode,
      playOrderConfirm,
      ensurePresenceReady,
      showtimeIntents,
      hostActions,
      presenceCanStart,
      onlineUids,
      playerCount,
      setCustomOpen,
      setCustomStartPending,
    ]
  );

  const closeCustomTopic = useCallback(() => {
    closeCustomTopicHelper({
      roomId,
      isHost,
      setCustomOpen,
      setCustomStartPending,
      clearAutoStartLock,
      onFeedback,
    });
  }, [clearAutoStartLock, isHost, onFeedback, roomId, setCustomOpen, setCustomStartPending]);

  return {
    quickStart,
    quickStartPending,
    isResetting,
    resetUiPending,
    isRestarting,
    resetGame,
    restartGame,
    handleNextGame,
    evalSorted,
    evalSortedPending,
    customOpen,
    setCustomOpen,
    closeCustomTopic,
    customText,
    setCustomText,
    customStartPending,
    handleSubmitCustom,
    effectiveDefaultTopicType,
    presenceCanStart,
    presenceForceEligible,
    presenceWaitRemainingMs,
  };
}
