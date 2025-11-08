import { notify, muteNotifications } from "@/components/ui/notify";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { db } from "@/lib/firebase/client";
import {
  resetRoomWithPrune,
  submitSortedOrder,
  topicControls,
  beginRevealPending,
} from "@/lib/game/service";
import { postRoundReset } from "@/lib/utils/broadcast";
import {
  handleFirebaseQuotaError,
  isFirebaseQuotaExceeded,
} from "@/lib/utils/errorHandling";
import { logInfo } from "@/lib/utils/log";
import { calculateEffectiveActive } from "@/lib/utils/playerCount";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { toastIds } from "@/lib/ui/toastIds";
import type {
  ShowtimeIntentHandlers,
  ShowtimeIntentMetadata,
} from "@/lib/showtime/types";
import { doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/functions";
import { useCallback, useMemo, useState } from "react";

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
    options?: { broadcast?: boolean }
  ) => void;
  clearAutoStartLock: () => void;
  actualResolveMode: "sort-submit";
  defaultTopicType?: string | null;
  roundIds?: string[] | null;
  onlineUids?: string[] | null | undefined;
  proposal?: string[] | null;
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

  const quickStart = useCallback(
    async (options?: QuickStartOptions) => {
      if (quickStartPending) return false;
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
      if (!ensurePresenceReady()) {
        return false;
      }
      setQuickStartPending(true);

      if (options?.markShowtimeStart ?? true) {
        showtimeIntents?.markStartIntent?.({
          action: options?.intentMeta?.action ?? "quickStart",
          source: options?.intentMeta?.source ?? "useHostActions",
        });
      }

      let effectiveType = effectiveDefaultTopicType;
      let latestTopic: string | null | undefined = currentTopic ?? null;
      let traceDetail: Record<string, unknown> | undefined;

      muteNotifications(
        [
          toastIds.topicChangeSuccess(roomId),
          toastIds.topicShuffleSuccess(roomId),
          toastIds.numberDealSuccess(roomId),
          toastIds.gameReset(roomId),
        ],
        2800
      );

      try {
        if (db) {
          const snap = await getDoc(doc(db, "rooms", roomId));
          const data = snap.data() as any;
          const fetchedType = data?.options?.defaultTopicType as string | undefined;
          if (fetchedType) {
            effectiveType = fetchedType;
          }
          const topicFromSnapshot = data?.topic;
          if (typeof topicFromSnapshot === "string") {
            latestTopic = topicFromSnapshot;
          } else if (topicFromSnapshot == null) {
            latestTopic = null;
          }
        }
      } catch {
        // snapshot fetch failure can be ignored
      }

      if (
        effectiveType === "カスタム" &&
        !(typeof latestTopic === "string" && latestTopic.trim().length > 0)
      ) {
        setCustomStartPending(true);
        setCustomText("");
        setCustomOpen(true);
        setQuickStartPending(false);
        return false;
      }

      const shouldBroadcast = options?.broadcast ?? true;
      const shouldPlaySound = options?.playSound ?? true;
      traceDetail = {
        roomId,
        type: effectiveType,
        broadcast: shouldBroadcast ? "1" : "0",
        playSound: shouldPlaySound ? "1" : "0",
      };
      traceAction("ui.host.quickStart", traceDetail);
      beginAutoStartLock(4500, { broadcast: shouldBroadcast });

      let success = false;
      try {
        if (shouldPlaySound) {
          playOrderConfirm();
        }
        const callable = functions
          ? httpsCallable<
              { roomId: string; options?: Record<string, unknown> },
              { assignedCount?: number; topicType?: string; topic?: string | null; durationMs?: number }
            >(functions, "quickStart")
          : null;
        if (!callable) {
          throw new Error("firebase-functions-unavailable");
        }
        const response = await callable({
          roomId,
          options: {
            defaultTopicType: effectiveType,
            skipPresence: shouldSkipPresenceCheck,
          },
        });
        const payload = response?.data ?? {};
        traceAction("ui.host.quickStart.result", {
          roomId,
          assigned: String(payload.assignedCount ?? -1),
          topicType: payload.topicType ?? effectiveType,
          topic: payload.topic ?? "",
        });

        try {
          delete (window as any).__ITO_LAST_RESET;
        } catch {}

        try {
          postRoundReset(roomId);
        } catch {}

        muteNotifications(
          [
            toastIds.topicChangeSuccess(roomId),
            toastIds.topicShuffleSuccess(roomId),
            toastIds.numberDealSuccess(roomId),
            toastIds.gameReset(roomId),
          ],
          2800
        );

        notify({
          id: toastIds.gameStart(roomId),
          title: "ゲームを開始しました",
          type: "success",
          duration: 2000,
        });
        success = true;
      } catch (error: any) {
        clearAutoStartLock();
        traceError("ui.host.quickStart", error, traceDetail ?? { roomId });
        if (isFirebaseQuotaExceeded(error)) {
          handleFirebaseQuotaError("ゲーム開始");
        } else {
          const message = error?.message || "処理に失敗しました";
          notify({
            id: toastIds.gameStartError(roomId),
            title: "ゲーム開始に失敗しました",
            description: message,
            type: "error",
          });
        }
      } finally {
        setQuickStartPending(false);
      }

      return success;
    },
    [
      quickStartPending,
      effectiveDefaultTopicType,
      beginAutoStartLock,
      clearAutoStartLock,
      playOrderConfirm,
      roomId,
      ensurePresenceReady,
      playerCount,
      presenceReady,
      onlineUids,
      functions,
      showtimeIntents,
    ]
  );

  const resetGame = useCallback(
    async (options?: ResetOptions) => {
      const showFeedback = options?.showFeedback ?? true;
      const shouldPlaySound = options?.playSound ?? true;
      const includeOnline = options?.includeOnline ?? true;
      const recallSpectators =
        options?.recallSpectators ?? true;
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
        const keepSet = new Set<string>();
        if (Array.isArray(roundIds)) {
          roundIds.forEach((id) => {
            if (typeof id === "string" && id.trim()) keepSet.add(id);
          });
        }
        if (includeOnline && Array.isArray(onlineUids)) {
          onlineUids.forEach((id) => {
            if (typeof id === "string" && id.trim()) keepSet.add(id);
          });
        }
        const keep = Array.from(keepSet);

        const shouldPrune = (() => {
          try {
            const raw = (process.env.NEXT_PUBLIC_RESET_PRUNE || "")
              .toString()
              .toLowerCase();
            if (!raw) return true;
            return !(raw === "0" || raw === "false");
          } catch {
            return true;
          }
        })();

        traceAction("ui.room.reset", {
          roomId,
          keep: String(keep.length),
          prune: shouldPrune ? "1" : "0",
          recall: recallSpectators ? "1" : "0",
        });

        if (shouldPrune && Array.isArray(roundIds) && roundIds.length > 0) {
          const keepLookup = new Set(keep);
          const targets = roundIds.filter((id) => !keepLookup.has(id));
          if (targets.length > 0) {
            try {
              const auth = getAuth();
              const user = auth.currentUser;
              const token = await user?.getIdToken();
              if (token && user?.uid) {
                logInfo("rooms", "reset prune request", {
                  roomId,
                  targetsCount: targets.length,
                });
                await fetch(`/api/rooms/${roomId}/prune`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    token,
                    callerUid: user.uid,
                    targets,
                  }),
                }).catch(() => {});
              }
            } catch {
              // prune failures are non-fatal
            }
        }
      }

      notify({
        id: toastIds.gameReset(roomId),
        title: "待機状態に戻しています…",
        type: "info",
        duration: 2000,
      });

      await resetRoomWithPrune(roomId, keep, {
        notifyChat: true,
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
        try {
          postRoundReset(roomId);
        } catch {}
      } catch (error: any) {
        traceError("ui.room.reset", error, { roomId });
        const msg = String(error?.message || error || "");
        console.error("❌ resetGame: 失敗", error);
        notify({
          id: toastIds.genericError(roomId, "game-reset"),
          title: "リセットに失敗しました",
          description: msg,
          type: "error",
        });
        onFeedback?.(null);
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

    traceAction("ui.host.nextGame", { roomId });
    beginAutoStartLock(5000, { broadcast: true });
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
      await submitSortedOrder(roomId, list);
      if (startedAt !== null) {
        setMetric(
          "order",
          "submitSortedOrderSuccessMs",
          Math.round(performance.now() - startedAt)
        );
      }
      if (REVEAL_DELAY_MS > 0) {
        await new Promise((resolve) => setTimeout(resolve, REVEAL_DELAY_MS));
      }
      try {
        await beginRevealPending(roomId);
      } catch (revealError) {
        traceError("ui.order.submit.revealPending", revealError, {
          roomId,
        });
      }
    } catch (error: any) {
      if (startedAt !== null) {
        setMetric(
          "order",
          "submitSortedOrderFailureMs",
          Math.round(performance.now() - startedAt)
        );
      }
      traceError("ui.order.submit", error, { roomId, count: list.length });
      notify({
        id: toastIds.genericError(roomId, "submit-order"),
        title: "並びの確定に失敗しました",
        description:
          error?.message ||
          "提出枚数や並び順を確認して、もう一度お試しください。",
        type: "error",
      });
      throw error;
    }
  }, [proposal, playOrderConfirm, roomId, showtimeIntents]);

  const handleSubmitCustom = useCallback(
    async (value: string) => {
      const trimmed = (value || "").trim();
      if (!trimmed) return;
      traceAction("ui.topic.customSubmit", {
        roomId,
        isHost: isHost ? "1" : "0",
      });
      try {
        await topicControls.setCustomTopic(roomId, trimmed);
      } catch (error) {
        setCustomStartPending(false);
        traceError("ui.topic.customSubmit", error, {
          roomId,
          stage: "setTopic",
        });
        throw error;
      }
      setCustomOpen(false);

      if (!isHost) {
        setCustomStartPending(false);
        notify({
          id: toastIds.topicChangeSuccess(roomId),
          title: "お題を更新しました",
          description: "ホストが開始するとゲームがスタートします",
          type: "success",
          duration: 1800,
        });
        return;
      }

      try {
        if (
          (roomStatus === "waiting" || customStartPending) &&
          actualResolveMode === "sort-submit"
        ) {
          if (!ensurePresenceReady()) {
            return;
          }
          showtimeIntents?.markStartIntent?.({
            action: "quickStart:customTopic",
            source: "useHostActions",
          });
          playOrderConfirm();
          const callable = functions
            ? httpsCallable<
                { roomId: string; options?: Record<string, unknown> },
                { assignedCount?: number; topicType?: string; topic?: string | null; durationMs?: number }
              >(functions, "quickStart")
            : null;
          if (!callable) {
            throw new Error("firebase-functions-unavailable");
          }
          const result = await callable({
            roomId,
            options: {
              defaultTopicType: "カスタム",
              customTopic: trimmed,
            },
          });
          traceAction("ui.topic.customSubmit.quickStartResult", {
            roomId,
            assigned: String(result?.data?.assignedCount ?? -1),
          });
          try {
            postRoundReset(roomId);
          } catch {}
          notify({
            id: toastIds.gameStart(roomId),
            title: "カスタムお題で開始",
            type: "success",
            duration: 2000,
          });
        }
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
      functions,
      showtimeIntents,
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
