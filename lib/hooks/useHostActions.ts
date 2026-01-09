import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { db } from "@/lib/firebase/client";
import { useHostSession } from "@/lib/hooks/useHostSession";
import {
  createHostActionsController,
  type HostActionsController,
} from "@/lib/host/HostActionsController";
import type { RoundStageEvent } from "@/lib/hooks/useRoundTimeline";
import { setMetric } from "@/lib/utils/metrics";
import { runQuickStartFromWaiting } from "@/lib/hooks/hostActions/runQuickStartFromWaiting";
import { runNextGameWithNextRoundApi } from "@/lib/hooks/hostActions/runNextGameWithNextRoundApi";
import { runEvalSortedSubmit } from "@/lib/hooks/hostActions/runEvalSortedSubmit";
import { runSubmitCustomTopicAndMaybeStart } from "@/lib/hooks/hostActions/runSubmitCustomTopicAndMaybeStart";
import { runResetRoomToWaiting } from "@/lib/hooks/hostActions/runResetRoomToWaiting";
import { runRestartGame } from "@/lib/hooks/hostActions/runRestartGame";
import { closeCustomTopic as closeCustomTopicHelper } from "@/lib/hooks/hostActions/closeCustomTopic";
import { useHostActionMetrics } from "@/lib/hooks/hostActions/useHostActionMetrics";
import { useHostActionRoomStatusSync } from "@/lib/hooks/hostActions/useHostActionRoomStatusSync";
import { useHostActionStatusVersionSync } from "@/lib/hooks/hostActions/useHostActionStatusVersionSync";
import { useHostActionTimersCleanup } from "@/lib/hooks/hostActions/useHostActionTimersCleanup";
import { useActionCooldown } from "@/lib/hooks/hostActions/useActionCooldown";
import { usePendingVisibilityKick } from "@/lib/hooks/hostActions/usePendingVisibilityKick";
import { usePresenceStartGate } from "@/lib/hooks/hostActions/usePresenceStartGate";
import { useResetUiHold } from "@/lib/hooks/hostActions/useResetUiHold";
import type {
  ShowtimeIntentHandlers,
  ShowtimeIntentMetadata,
} from "@/lib/showtime/types";
import { getAuth } from "firebase/auth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  const actionLatencyRef = useRef<Record<string, number>>({});
  const quickStartPendingRef = useLatestRef(quickStartPending);
  const isRestartingRef = useLatestRef(isRestarting);
  const pendingVisibilityKickAtRef = useRef<number>(0);
  const evalSortedPendingRef = useRef(false);
  const mountedRef = useRef(true);
  const lastActionAtRef = useRef<Record<string, number>>({});
  const latestRoomStatusRef = useLatestRef(roomStatus);
  const quickStartStuckTimerRef = useRef<number | null>(null);
  const quickStartEarlySyncTimerRef = useRef<number | null>(null);
  const quickStartOkAtRef = useRef<number | null>(null);
  const nextGameStuckTimerRef = useRef<number | null>(null);
  const nextGameEarlySyncTimerRef = useRef<number | null>(null);
  const nextGameOkAtRef = useRef<number | null>(null);
  const resetOkAtRef = useRef<number | null>(null);
  const resetStuckTimerRef = useRef<number | null>(null);
  const resetEarlySyncTimerRef = useRef<number | null>(null);
  const latestStatusVersionRef = useRef<number>(
    normalizeStatusVersion(statusVersion)
  );
  const expectedStatusVersionRef = useRef<{
    quickStart: number | null;
    nextGame: number | null;
    reset: number | null;
  }>({ quickStart: null, nextGame: null, reset: null });
  const auth = getAuth();
  const { sessionId, ensureSession } = useHostSession(roomId, async () => {
    const idToken = await auth?.currentUser?.getIdToken();
    return idToken ?? null;
  });
  const hostActions = useMemo<HostActionsController>(
    () =>
      createHostActionsController({
        getSessionId: () => sessionId,
        ensureSession,
      }),
    [ensureSession, sessionId]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useHostActionStatusVersionSync({
    statusVersion,
    latestStatusVersionRef,
    expectedStatusVersionRef,
    resetOkAtRef,
    quickStartOkAtRef,
    nextGameOkAtRef,
  });

  usePendingVisibilityKick({
    roomId,
    latestRoomStatusRef,
    quickStartPendingRef,
    isRestartingRef,
    pendingVisibilityKickAtRef,
  });

  useHostActionTimersCleanup({
    quickStartStuckTimerRef,
    quickStartEarlySyncTimerRef,
    nextGameStuckTimerRef,
    nextGameEarlySyncTimerRef,
    resetStuckTimerRef,
    resetEarlySyncTimerRef,
  });

  useHostActionRoomStatusSync({
    roomStatus,
    quickStartStuckTimerRef,
    quickStartEarlySyncTimerRef,
    nextGameStuckTimerRef,
    nextGameEarlySyncTimerRef,
    resetStuckTimerRef,
    resetEarlySyncTimerRef,
    expectedStatusVersionRef,
    resetOkAtRef,
    quickStartOkAtRef,
    nextGameOkAtRef,
    setQuickStartPending,
    setIsRestarting,
  });

  const { markActionStart, finalizeAction, abortAction } = useHostActionMetrics({
    actionLatencyRef,
  });

  // Host-only start confirmation sound. Global start cue is controlled in Showtime (currently muted).
  const playOrderConfirm = useSoundEffect("order_confirm");
  const playResetGame = useSoundEffect("reset_game");

  const effectiveDefaultTopicType = useMemo(() => {
    if (defaultTopicType && typeof defaultTopicType === "string") {
      return defaultTopicType;
    }
    return "通常版";
  }, [defaultTopicType]);

  const {
    presenceForceEligible,
    presenceCanStart,
    presenceWaitRemainingMs,
    ensurePresenceReady,
  } = usePresenceStartGate({
    roomId,
    presenceReady,
    presenceDegraded,
    playerCount,
  });

  useEffect(() => {
    expectedStatusVersionRef.current = { quickStart: null, nextGame: null, reset: null };
    setMetric("hostAction", "quickStart.expectedStatusVersion", null);
    setMetric("hostAction", "nextGame.expectedStatusVersion", null);
    setMetric("hostAction", "reset.expectedStatusVersion", null);
  }, [roomId]);

  const { resetUiPending, beginResetUiHold, clearResetUiHold } = useResetUiHold({ roomStatus });

  const canProceed = useActionCooldown({ cooldownMs: 420, lastActionAtRef });

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
  }, [proposal, playOrderConfirm, roomId, showtimeIntents, hostActions]);

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

function useLatestRef<T>(value: T) {
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  return valueRef;
}

function normalizeStatusVersion(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
