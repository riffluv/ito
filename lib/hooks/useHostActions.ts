import { db } from "@/lib/firebase/client";
import { useHostActionsRuntime } from "@/lib/hooks/hostActions/useHostActionsRuntime";
import type { RoundStageEvent } from "@/lib/hooks/useRoundTimeline";
import { runQuickStartFromWaiting } from "@/lib/hooks/hostActions/runQuickStartFromWaiting";
import { runNextGameWithNextRoundApi } from "@/lib/hooks/hostActions/runNextGameWithNextRoundApi";
import { runEvalSortedSubmit } from "@/lib/hooks/hostActions/runEvalSortedSubmit";
import { runSubmitCustomTopicAndMaybeStart } from "@/lib/hooks/hostActions/runSubmitCustomTopicAndMaybeStart";
import { runResetRoomToWaiting } from "@/lib/hooks/hostActions/runResetRoomToWaiting";
import { runRestartGame } from "@/lib/hooks/hostActions/runRestartGame";
import { closeCustomTopic as closeCustomTopicHelper } from "@/lib/hooks/hostActions/closeCustomTopic";
import type {
  ShowtimeIntentHandlers,
  ShowtimeIntentMetadata,
} from "@/lib/showtime/types";
import { useCallback, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    __ITO_LAST_RESET?: number;
  }
}

type QuickStartOptions = {
  broadcast?: boolean;
  playSound?: boolean;
  markShowtimeStart?: boolean;
  intentMeta?: ShowtimeIntentMetadata;
};

type ResetOptions = {
  showFeedback?: boolean;
  playSound?: boolean;
  includeOnline?: boolean;
  recallSpectators?: boolean;
};

type HostActionFeedback =
  | { message: string; tone: "info" | "success" }
  | null;

type UseHostActionsOptions = {
  roomId: string;
  roomStatus?: string;
  statusVersion?: number | null;
  isHost: boolean;
  isRevealAnimating: boolean;
  autoStartLocked: boolean;
  beginAutoStartLock: (
    duration: number,
    options?: { broadcast?: boolean; delayMs?: number }
  ) => void;
  clearAutoStartLock: () => void;
  actualResolveMode: "sort-submit";
  defaultTopicType?: string | null;
  roundIds?: string[] | null;
  onlineUids?: string[] | null | undefined;
  proposal?: (string | null)[] | null;
  currentTopic?: string | null;
  onFeedback?: (payload: HostActionFeedback) => void;
  presenceReady?: boolean;
  presenceDegraded?: boolean;
  playerCount?: number;
  showtimeIntents?: ShowtimeIntentHandlers;
  onStageEvent?: (event: RoundStageEvent) => void;
};

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
  const [quickStartPending, setQuickStartPending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customStartPending, setCustomStartPending] = useState(false);
  const [customText, setCustomText] = useState("");
  const [evalSortedPending, setEvalSortedPending] = useState(false);
  const evalSortedPendingRef = useRef(false);
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
      onStageEvent,
      canProceed,
    ]
  );

  const resetGame = useCallback(
    async (options?: ResetOptions) => {
      const showFeedback = options?.showFeedback ?? true;
      const shouldPlaySound = options?.playSound ?? true;
      const includeOnline = options?.includeOnline ?? true;
      const recallSpectators =
        options?.recallSpectators ?? true;
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
  }, [proposal, playOrderConfirm, roomId, showtimeIntents, hostActions, mountedRef]);

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
  }, [clearAutoStartLock, isHost, onFeedback, roomId]);

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
