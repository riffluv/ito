import { notify, muteNotifications } from "@/components/ui/notify";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import {
  createHostActionsController,
  type HostActionsController,
} from "@/lib/host/HostActionsController";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { calculateEffectiveActive } from "@/lib/utils/playerCount";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { toastIds } from "@/lib/ui/toastIds";
import type {
  ShowtimeIntentHandlers,
  ShowtimeIntentMetadata,
} from "@/lib/showtime/types";
import { getAuth } from "firebase/auth";
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
  playerCount?: number;
  showtimeIntents?: ShowtimeIntentHandlers;
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
  playerCount,
  showtimeIntents,
}: UseHostActionsOptions) {
  const [quickStartPending, setQuickStartPending] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customStartPending, setCustomStartPending] = useState(false);
  const [customText, setCustomText] = useState("");
  const actionLatencyRef = useRef<Record<string, number>>({});
  const hostActions = useMemo<HostActionsController>(
    () => createHostActionsController(),
    []
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

  const playOrderConfirm = useSoundEffect("order_confirm");
  const playResetGame = useSoundEffect("reset_game");

  const effectiveDefaultTopicType = useMemo(() => {
    if (defaultTopicType && typeof defaultTopicType === "string") {
      return defaultTopicType;
    }
    return "通常版";
  }, [defaultTopicType]);

  const ensurePresenceReady = useCallback(() => {
    if (presenceReady) {
      return true;
    }
    traceAction("ui.host.presence.wait", { roomId });
    notify({
      id: toastIds.genericInfo(roomId, "presence-wait"),
      title: "参加者の接続を待っています",
      description: "全員のオンライン状態が揃うまで数秒お待ちください。",
      type: "info",
      duration: 2000,
    });
    return false;
  }, [presenceReady, roomId]);

  const syncRoundPreparing = useCallback(
    async (value: boolean) => {
      await hostActions.setRoundPreparingFlag(roomId, value);
    },
    [hostActions, roomId]
  );

  const quickStart = useCallback(
    async (options?: QuickStartOptions) => {
      if (quickStartPending) return false;
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
      const basePlayerCount =
        typeof playerCount === "number" && Number.isFinite(playerCount)
          ? Math.max(0, playerCount)
          : 0;
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

        const result = await hostActions.quickStartWithTopic({
          roomId,
          roomStatus,
          defaultTopicType: effectiveDefaultTopicType,
          presenceInfo: {
            presenceReady,
            onlineUids,
            playerCount: basePlayerCount,
          },
          currentTopic,
        });

        if (!result.ok) {
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
          } else if (result.reason === "needs-custom-topic") {
            setCustomStartPending(true);
            setCustomText("");
            setCustomOpen(true);
          } else if (result.reason === "functions-unavailable") {
            throw new Error("firebase-functions-unavailable");
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
      onlineUids,
      showtimeIntents,
      abortAction,
      markActionStart,
      isHost,
      finalizeAction,
      hostActions,
      roomStatus,
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
        traceError("ui.room.reset", error, { roomId });
        const msg =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "";
        console.error("❌ resetGame: 失敗", error);
        notify({
          id: toastIds.genericError(roomId, "game-reset"),
          title: "リセットに失敗しました",
          description: msg,
          type: "error",
        });
        onFeedback?.(null);
        finalizeAction("reset", "error");
      } finally {
        setIsResetting(false);
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

  const handleNextGame = useCallback(async () => {
    if (!isHost) return;
    if (autoStartLocked || quickStartPending) return;
    if (roomStatus === "reveal" && isRevealAnimating) return;

    let markedRoundPreparing = false;
    await syncRoundPreparing(true);
    markedRoundPreparing = true;
    traceAction("ui.host.nextGame", { roomId });
    beginAutoStartLock(3200, { broadcast: true, delayMs: 80 });
    setIsRestarting(true);
    try {
      playOrderConfirm();
      const ok = await restartGame({ playSound: false });
      if (!ok) {
        clearAutoStartLock();
      }
    } catch (error) {
      clearAutoStartLock();
      traceError("ui.host.nextGame", error, { roomId });
      console.error("❌ nextGameButton: 失敗", error);
    } finally {
      setIsRestarting(false);
      if (markedRoundPreparing) {
        await syncRoundPreparing(false);
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
    restartGame,
    clearAutoStartLock,
    roomId,
    syncRoundPreparing,
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
            presenceReady,
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
    presenceReady,
    onlineUids,
    playerCount,
  ]
);

  return {
    quickStart,
    quickStartPending,
    isResetting,
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
  };
}
