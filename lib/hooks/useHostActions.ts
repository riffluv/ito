import { notify, muteNotifications } from "@/components/ui/notify";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { db } from "@/lib/firebase/client";
import { useHostSession } from "@/lib/hooks/useHostSession";
import {
  createHostActionsController,
  type HostActionsController,
} from "@/lib/host/HostActionsController";
import {
  type RoundStageEvent,
} from "@/lib/hooks/useRoundTimeline";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { calculateEffectiveActive } from "@/lib/utils/playerCount";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { toastIds } from "@/lib/ui/toastIds";
import { handleQuickStartFailure } from "@/lib/hooks/hostActions/handleQuickStartFailure";
import { runQuickStartWithNotWaitingRetry } from "@/lib/hooks/hostActions/runQuickStartWithNotWaitingRetry";
import { scheduleResetSyncWatchdogs } from "@/lib/hooks/hostActions/scheduleResetSyncWatchdogs";
import { scheduleQuickStartSyncWatchdogs } from "@/lib/hooks/hostActions/scheduleQuickStartSyncWatchdogs";
import { runNextGameWithNextRoundApi } from "@/lib/hooks/hostActions/runNextGameWithNextRoundApi";
import { runEvalSortedSubmit } from "@/lib/hooks/hostActions/runEvalSortedSubmit";
import { runSubmitCustomTopicAndMaybeStart } from "@/lib/hooks/hostActions/runSubmitCustomTopicAndMaybeStart";
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
  const quickStartPendingRef = useRef(quickStartPending);
  const isRestartingRef = useRef(isRestarting);
  const pendingVisibilityKickAtRef = useRef<number>(0);
  const evalSortedPendingRef = useRef(false);
  const mountedRef = useRef(true);
  const lastActionAtRef = useRef<Record<string, number>>({});
  const latestRoomStatusRef = useRef<string | undefined>(roomStatus);
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
    typeof statusVersion === "number" && Number.isFinite(statusVersion) ? statusVersion : 0
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

  useEffect(() => {
    quickStartPendingRef.current = quickStartPending;
  }, [quickStartPending]);

  useEffect(() => {
    isRestartingRef.current = isRestarting;
  }, [isRestarting]);

  useEffect(() => {
    latestRoomStatusRef.current = roomStatus;
  }, [roomStatus]);

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
      if (quickStartPending) return false;
      if (!canProceed("quickStart")) return false;
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
      if (roomStatus && roomStatus !== "waiting" && !isRestartIntent) {
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
          ? onlineUids.filter(
              (id): id is string =>
                typeof id === "string" && id.trim().length > 0
            ).length
          : undefined;
      const activeCount = calculateEffectiveActive(
        onlineCount,
        basePlayerCount,
        { maxDrift: 3 }
      );
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
          typeof (options.intentMeta as { shouldAbort?: unknown }).shouldAbort ===
            "function"
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
          const message =
            error instanceof Error ? error.message : "処理に失敗しました";
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
    },
    [
      quickStartPending,
      effectiveDefaultTopicType,
      beginAutoStartLock,
      clearAutoStartLock,
      playOrderConfirm,
      roomId,
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
      finalizeAction,
      hostActions,
      roomStatus,
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
        if (
          typeof performance !== "undefined" &&
          latestRoomStatusRef.current !== "waiting"
        ) {
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
        // Hold the UI in a waiting-like state until Firestore/FSM catches up.
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
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "";
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
    },
    [
      roomId,
      onFeedback,
      playResetGame,
      roundIds,
      onlineUids,
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
      traceAction("ui.host.restart", {
        roomId,
        playSound: playSound ? "1" : "0",
      });
      try {
        await resetGame({
          showFeedback: false,
          playSound,
          includeOnline: false,
          recallSpectators: false,
        });
        return await quickStart({
          broadcast: false,
          playSound,
          markShowtimeStart: false,
          intentMeta: { action: "quickStart:restart" },
        });
      } catch (error) {
        traceError("ui.host.restart", error, { roomId });
        throw error;
      }
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
    setCustomOpen(false);
    setCustomStartPending(false);
    clearAutoStartLock();
    onFeedback?.(null);
    traceAction("ui.topic.customClose", {
      roomId,
      isHost: isHost ? "1" : "0",
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
