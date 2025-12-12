import { notify, muteNotifications } from "@/components/ui/notify";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
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
import { PRESENCE_FORCE_START_AFTER_MS } from "@/lib/constants/presence";
import { calculateEffectiveActive } from "@/lib/utils/playerCount";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { toastIds } from "@/lib/ui/toastIds";
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
  const [resetUiPending, setResetUiPending] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customStartPending, setCustomStartPending] = useState(false);
  const [customText, setCustomText] = useState("");
  const actionLatencyRef = useRef<Record<string, number>>({});
  const presenceWarningShownRef = useRef(false);
  const presenceWaitSinceRef = useRef<number | null>(null);
  const [presenceWaitedMs, setPresenceWaitedMs] = useState(0);
  const resetUiTimerRef = useRef<number | null>(null);
  const lastActionAtRef = useRef<Record<string, number>>({});
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

  const markActionStart = useCallback((action: string) => {
    if (typeof performance !== "undefined") {
      actionLatencyRef.current[action] = performance.now();
    }
    setMetric("hostAction", `${action}.pending`, 1);
  }, []);

  const finalizeAction = useCallback((action: string, status: "success" | "error") => {
    const start = actionLatencyRef.current[action];
    if (typeof start === "number" && typeof performance !== "undefined") {
      setMetric("hostAction", `${action}.latencyMs`, Math.round(performance.now() - start));
    }
    delete actionLatencyRef.current[action];
    setMetric("hostAction", `${action}.pending`, 0);
    setMetric("hostAction", `${action}.result`, status === "success" ? 1 : -1);
  }, []);

  const abortAction = useCallback((action: string) => {
    if (actionLatencyRef.current[action]) {
      delete actionLatencyRef.current[action];
    }
    setMetric("hostAction", `${action}.pending`, 0);
  }, []);

  // Host-only start confirmation sound. Global start cue is controlled in Showtime (currently muted).
  const playOrderConfirm = useSoundEffect("order_confirm");
  const playResetGame = useSoundEffect("reset_game");

  const effectiveDefaultTopicType = useMemo(() => {
    if (defaultTopicType && typeof defaultTopicType === "string") {
      return defaultTopicType;
    }
    return "通常版";
  }, [defaultTopicType]);

  // presence の初期同期が遅延した場合の待ち時間を計測し、一定時間で強制開始を許可する。
  useEffect(() => {
    if (typeof window === "undefined") {
      return () => {};
    }
    if (presenceReady || presenceDegraded) {
      presenceWaitSinceRef.current = null;
      setPresenceWaitedMs(0);
      return () => {};
    }
    if (presenceWaitSinceRef.current === null) {
      presenceWaitSinceRef.current = Date.now();
    }
    const tick = () => {
      const since = presenceWaitSinceRef.current;
      if (since === null) return;
      setPresenceWaitedMs(Date.now() - since);
    };
    tick();
    const handle = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(handle);
    };
  }, [presenceReady, presenceDegraded, roomId]);

  const presenceForceEligible =
    !presenceReady &&
    !presenceDegraded &&
    presenceWaitedMs >= PRESENCE_FORCE_START_AFTER_MS;
  const presenceCanStart =
    presenceReady || presenceDegraded || presenceForceEligible;
  const presenceWaitRemainingMs = useMemo(() => {
    if (presenceCanStart) return 0;
    return Math.max(PRESENCE_FORCE_START_AFTER_MS - presenceWaitedMs, 0);
  }, [presenceCanStart, presenceWaitedMs]);

  const ensurePresenceReady = useCallback(() => {
    if (presenceReady) {
      return true;
    }
    const forceAllowed = presenceForceEligible;
    if (presenceDegraded === true || forceAllowed) {
      if (!presenceWarningShownRef.current) {
        notify({
          id: toastIds.genericInfo(roomId, "presence-warn"),
          title: "接続状況を確認できません",
          description: "プレイヤー一覧をもとに開始を続行します。",
          type: "info",
          duration: 2400,
        });
        presenceWarningShownRef.current = true;
      }
      traceAction("ui.host.presence.degraded", {
        roomId,
        ready: presenceReady ? "1" : "0",
        degraded: presenceDegraded ? "1" : "0",
        forced: forceAllowed ? "1" : "0",
        waitedMs: Math.round(presenceWaitedMs),
        players: typeof playerCount === "number" ? playerCount : -1,
      });
      return true;
    }

    traceAction("ui.host.presence.wait", {
      roomId,
      waitedMs: Math.round(presenceWaitedMs),
    });
    notify({
      id: toastIds.genericInfo(roomId, "presence-wait"),
      title: "参加者の接続を待っています",
      description: "全員のオンライン状態が揃うまで数秒お待ちください。",
      type: "info",
      duration: 2000,
    });
    return false;
  }, [
    presenceReady,
    presenceDegraded,
    presenceForceEligible,
    presenceWaitedMs,
    playerCount,
    roomId,
  ]);

  useEffect(() => {
    presenceWarningShownRef.current = false;
  }, [roomId]);

  const clearResetUiHold = useCallback(() => {
    if (typeof window !== "undefined" && resetUiTimerRef.current !== null) {
      window.clearTimeout(resetUiTimerRef.current);
      resetUiTimerRef.current = null;
    }
    setResetUiPending(false);
  }, []);

  const ACTION_COOLDOWN_MS = 420;
  const canProceed = useCallback(
    (key: string) => {
      const now = Date.now();
      const last = lastActionAtRef.current[key] ?? 0;
      if (now - last < ACTION_COOLDOWN_MS) {
        return false;
      }
      lastActionAtRef.current[key] = now;
      return true;
    },
    []
  );

  const beginResetUiHold = useCallback((durationMs = 2800) => {
    if (typeof window === "undefined") return;
    setResetUiPending(true);
    if (resetUiTimerRef.current !== null) {
      window.clearTimeout(resetUiTimerRef.current);
    }
    resetUiTimerRef.current = window.setTimeout(() => {
      setResetUiPending(false);
      resetUiTimerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    if (roomStatus === "waiting") {
      clearResetUiHold();
    }
  }, [roomStatus, clearResetUiHold]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && resetUiTimerRef.current !== null) {
        window.clearTimeout(resetUiTimerRef.current);
        resetUiTimerRef.current = null;
      }
    };
  }, []);

  // NOTE: setRoundPreparingFlag は現在 next-round 専用フロー内でのみ使用しているため、
  // ここでの直接呼び出しは一旦無効化している（将来のUI連携用に残しておく）。
  const _syncRoundPreparing = useCallback(
    async (value: boolean) => {
      await hostActions.setRoundPreparingFlag(roomId, value);
    },
    [hostActions, roomId]
  );

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

        let attempts = 0;
        // restart intent（次のゲーム）の場合は最初から allowFromFinished: true で呼び出す
        // これにより reset の Firestore 伝播を待たずに reveal/finished → clue に直接遷移できる
        const isRestartFlow = !!isRestartIntent;
        let result = await hostActions.quickStartWithTopic({
          roomId,
          roomStatus,
          defaultTopicType: effectiveDefaultTopicType,
          presenceInfo: {
            presenceReady: presenceCanStart,
            onlineUids,
            playerCount: basePlayerCount,
          },
          currentTopic,
          allowFromFinished: isRestartFlow,
        });

        // 409 invalid_status → reason: not-waiting を明示的に処理。
        // allowFromFinished=true でリトライすることで、Firestore 伝播のレース条件を回避。
        const MAX_RETRY_ATTEMPTS = 3;
        while (!result.ok && result.reason === "not-waiting" && attempts < MAX_RETRY_ATTEMPTS) {
          attempts += 1;
          const currentStatus = result.roomStatus ?? roomStatus ?? "unknown";
          traceAction("ui.host.quickStart.notWaiting", {
            roomId,
            status: currentStatus,
            attempt: String(attempts),
          });
          notify({
            id: toastIds.genericInfo(roomId, "quickstart-not-waiting"),
            title: "前のラウンドを待機状態に戻しています…",
            description: "少し待って再開します。",
            type: "info",
            duration: 1800,
          });

          // 進行中ステータスが残っている場合は待機リセットを実行
          let resetSucceeded = false;
          if (
            !currentStatus ||
            currentStatus === "finished" ||
            currentStatus === "reveal" ||
            currentStatus === "clue"
          ) {
            try {
              await hostActions.resetRoomToWaitingWithPrune({
                roomId,
                roundIds,
                onlineUids,
                includeOnline: false,
                recallSpectators: false,
              });
              resetSucceeded = true;
            } catch (error) {
              traceError("ui.host.quickStart.notWaitingReset", error, { roomId });
              // リセット失敗をユーザーに通知（握りつぶさない）
              console.warn("[quickStart] reset failed during retry", error);
              notify({
                id: toastIds.genericInfo(roomId, "quickstart-reset-failed"),
                title: "リセット処理に問題が発生しました",
                description: "もう一度お試しください。改善しない場合はページを再読み込みしてください。",
                type: "warning",
                duration: 3000,
              });
            }
          }

          // Firestore の伝播を待つ（リトライ回数に応じて待ち時間を増加）
          // リセット失敗時は待ち時間を長めに取る
          const baseWaitMs = resetSucceeded ? 700 : 1200;
          const waitMs = baseWaitMs + attempts * 350;
          await new Promise((resolve) => setTimeout(resolve, waitMs));

          // リトライ時は allowFromFinished=true + allowFromClue=true でレース条件に対応
          result = await hostActions.quickStartWithTopic({
            roomId,
            roomStatus,
            defaultTopicType: effectiveDefaultTopicType,
            presenceInfo: {
              presenceReady: presenceCanStart,
              onlineUids,
              playerCount: basePlayerCount,
            },
            currentTopic,
            allowFromFinished: true,
            allowFromClue: true,
          });
        }

        if (!result.ok) {
          // 失敗理由を明示的にログ出力（デバッグ用）
          traceAction("ui.host.quickStart.failed", {
            roomId,
            reason: result.reason,
            roomStatus: result.roomStatus ?? undefined,
            errorCode: result.errorCode ?? undefined,
            attempts: String(attempts),
          });
          console.warn("[quickStart] failed:", result.reason, {
            roomId,
            roomStatus: result.roomStatus,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          });

          if (result.reason === "presence-not-ready") {
            ensurePresenceReady();
          } else if (result.reason === "rate-limited") {
            notify({
              id: toastIds.genericInfo(roomId, "quickstart-rate-limited"),
              title: "少し間をおいて再試行しています…",
              description: "短時間に複数の開始要求が重なりました。",
              type: "info",
              duration: 1600,
            });
          } else if (result.reason === "host-mismatch") {
            notify({
              id: toastIds.genericInfo(roomId, "host-mismatch"),
              title: "ホスト権限の確定を待っています",
              description: "権限が移動した直後は数秒後にもう一度お試しください",
              type: "warning",
              duration: 2600,
            });
          } else if (result.reason === "auth-error") {
            notify({
              id: toastIds.genericInfo(roomId, "quickstart-auth"),
              title: "認証を更新できませんでした",
              description: "ブラウザを再読み込みして再試行してください。",
              type: "error",
              duration: 2600,
            });
          } else if (result.reason === "needs-custom-topic") {
            setCustomStartPending(true);
            setCustomText("");
            setCustomOpen(true);
          } else if (result.reason === "functions-unavailable") {
            throw new Error("firebase-functions-unavailable");
          } else if (result.reason === "not-waiting") {
            notify({
              id: toastIds.genericInfo(roomId, "quickstart-not-waiting-failed"),
              title: "ゲームを開始できませんでした",
              description: "前のラウンドが終了処理中の可能性があります。数秒後にもう一度お試しください。",
              type: "warning",
              duration: 2600,
            });
          }
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
        setQuickStartPending(false);
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
    if (!isHost) return;
    if (autoStartLocked || quickStartPending) return;
    if (roomStatus === "reveal" && isRevealAnimating) return;

    const startedAt =
      typeof performance !== "undefined" ? performance.now() : null;
    setIsRestarting(true);
    onStageEvent?.("round:prepare");
    if (!canProceed("nextGame")) {
      setIsRestarting(false);
      return;
    }

    try {
      traceAction("ui.host.nextGame", { roomId, method: "nextRound-api" });
      beginAutoStartLock(3200, { broadcast: true, delayMs: 80 });
      playOrderConfirm();

      // 新しい nextRound API を呼び出し（アトミックに全てを実行）
      const result = await hostActions.nextRound({
        roomId,
        topicType: defaultTopicType,
        customTopic: currentTopic,
      });

      if (!result.ok) {
        // 失敗時のログとトースト
        traceAction("ui.host.nextGame.failed", {
          roomId,
          reason: result.reason,
          errorCode: result.errorCode,
        });
        console.warn("[nextGame] nextRound API failed:", result.reason, result.errorMessage);

        if (result.reason === "forbidden") {
          notify({
            id: toastIds.genericInfo(roomId, "nextgame-forbidden"),
            title: "ホスト権限がありません",
            description: "権限が移動した可能性があります。",
            type: "warning",
            duration: 2600,
          });
        } else if (result.reason === "no_players") {
          notify({
            id: toastIds.genericInfo(roomId, "nextgame-no-players"),
            title: "プレイヤーがいません",
            description: "最低1人が入室してから開始してください。",
            type: "warning",
            duration: 2600,
          });
        } else if (result.reason === "rate-limited") {
          notify({
            id: toastIds.genericInfo(roomId, "nextgame-rate-limit"),
            title: "処理を順番待ちしています…",
            description: "短時間に複数の開始要求が重なりました。",
            type: "info",
            duration: 1600,
          });
        } else {
          notify({
            id: toastIds.genericInfo(roomId, "nextgame-failed"),
            title: "次のゲームを開始できませんでした",
            description: "もう一度お試しください。",
            type: "warning",
            duration: 2600,
          });
        }
        clearAutoStartLock();
        return;
      }

      // 成功時のトースト
      notify({
        id: toastIds.gameStart(roomId),
        title: "お題とカードを配布しました！",
        type: "success",
        duration: 2000,
      });

      onStageEvent?.("round:start");
      onStageEvent?.("round:end");
    } catch (error) {
      clearAutoStartLock();
      traceError("ui.host.nextGame", error, { roomId });
      console.error("❌ nextGameButton: 失敗", error);
      notify({
        id: toastIds.genericInfo(roomId, "nextgame-error"),
        title: "エラーが発生しました",
        description: "しばらく待ってからもう一度お試しください。",
        type: "error",
        duration: 3000,
      });
      onStageEvent?.("round:abort");
    } finally {
      setIsRestarting(false);
      if (startedAt !== null) {
        setMetric(
          "hostAction",
          "nextGame.totalMs",
          Math.round(performance.now() - startedAt)
        );
      }
    }
  }, [
    isHost,
    autoStartLocked,
    quickStartPending,
    roomStatus,
    isRevealAnimating,
    beginAutoStartLock,
    playOrderConfirm,
    hostActions,
    roomId,
    defaultTopicType,
    currentTopic,
    clearAutoStartLock,
    onStageEvent,
    canProceed,
  ]);

  const REVEAL_DELAY_MS = 500;

  const evalSorted = useCallback(async () => {
    if (!proposal || proposal.length === 0) return;
    const list = proposal.filter(
      (value): value is string => typeof value === "string" && value.length > 0
    );
    if (list.length === 0) return;

    showtimeIntents?.markRevealIntent?.({
      action: "evalSorted",
      source: "useHostActions",
    });
    playOrderConfirm();

    const startedAt =
      typeof performance !== "undefined" ? performance.now() : null;
    try {
      traceAction("ui.order.submit", { roomId, count: list.length });
      await hostActions.evaluateSortedOrder({
        roomId,
        list,
        revealDelayMs: REVEAL_DELAY_MS,
      });
      if (startedAt !== null) {
        setMetric(
          "order",
          "submitSortedOrderSuccessMs",
          Math.round(performance.now() - startedAt)
        );
      }
    } catch (error: unknown) {
      if (startedAt !== null) {
        setMetric(
          "order",
          "submitSortedOrderFailureMs",
          Math.round(performance.now() - startedAt)
        );
      }
      traceError("ui.order.submit", error, { roomId, count: list.length });
      const description =
        error instanceof Error && error.message
          ? error.message
          : "提出枚数や並び順を確認して、もう一度お試しください。";
      notify({
        id: toastIds.genericError(roomId, "submit-order"),
        title: "並びの確定に失敗しました",
        description,
        type: "error",
      });
      throw error;
    }
  }, [proposal, playOrderConfirm, roomId, showtimeIntents, hostActions]);

  const handleSubmitCustom = useCallback(
    async (value: string) => {
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

        if (!shouldAutoStart) {
          notify({
            id: toastIds.topicChangeSuccess(roomId),
            title: "お題を更新しました",
            description: "ホストが開始するとゲームがスタートします",
            type: "success",
            duration: 1800,
          });
          return;
        }

        if (result && "ok" in result && result.ok === false) {
          if (result.reason === "presence-not-ready") {
            ensurePresenceReady();
          } else if (result.reason === "host-mismatch") {
            notify({
              id: toastIds.genericInfo(roomId, "host-mismatch"),
              title: "ホスト権限の確定を待っています",
              description: "権限が移動した直後は数秒後にもう一度お試しください",
              type: "warning",
              duration: 2600,
            });
          }
          return;
        }

        if ((result as { started?: boolean })?.started === false) {
          notify({
            id: toastIds.topicChangeSuccess(roomId),
            title: "お題を更新しました",
            description: "ホストが開始するとゲームがスタートします",
            type: "success",
            duration: 1800,
          });
          return;
        }

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
    customOpen,
    setCustomOpen,
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
