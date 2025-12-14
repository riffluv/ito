import { db } from "@/lib/firebase/client";
import {
  beginRevealPending,
  resetRoomWithPrune,
  submitSortedOrder,
  topicControls,
} from "@/lib/game/service";
import { postRoundReset } from "@/lib/utils/broadcast";
import { calculateEffectiveActive } from "@/lib/utils/playerCount";
import { traceAction, traceError } from "@/lib/utils/trace";
import type { RoomDoc } from "@/lib/types";
import { APP_VERSION } from "@/lib/constants/appVersion";
import {
  apiStartGame,
  apiNextRound,
  type ApiError,
} from "@/lib/services/roomApiClient";
import { getAuth } from "firebase/auth";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";

const generateRequestId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type HostSessionProvider = {
  getSessionId?: () => string | null;
  ensureSession?: () => Promise<string | null>;
};

type PresenceInfo = {
  presenceReady?: boolean;
  onlineUids?: (string | null | undefined)[] | null;
  playerCount?: number;
};

export type QuickStartRequest = {
  roomId: string;
  defaultTopicType?: string | null;
  roomStatus?: RoomDoc["status"] | string | null;
  presenceInfo?: PresenceInfo;
  currentTopic?: string | null;
  customTopic?: string | null;
  /** reveal/finished 状態からの開始を許可（次のゲーム用） */
  allowFromFinished?: boolean;
  /** clue 状態からの開始を許可（リトライ時のレース条件対策） */
  allowFromClue?: boolean;
};

export type QuickStartResult =
  | {
      ok: true;
      requestId: string;
      topicType: string;
      topic: string | null;
      assignedCount?: number;
      durationMs?: number;
      activeCount: number;
      skipPresence: boolean;
    }
  | {
      ok: false;
      requestId: string;
      reason:
        | "presence-not-ready"
        | "host-mismatch"
        | "needs-custom-topic"
        | "functions-unavailable"
        | "auth-error"
        | "not-waiting"
        | "rate-limited"
        | "callable-error";
      topicType?: string;
      topic?: string | null;
      hostId?: string | null;
      activeCount?: number;
      onlineCount?: number;
      playerCount?: number;
      roomStatus?: string | null;
      status?: number;
      url?: string;
      method?: string;
      details?: unknown;
      errorCode?: string;
      errorMessage?: string;
    };

export type ResetRoomRequest = {
  roomId: string;
  roundIds?: string[] | null;
  onlineUids?: (string | null | undefined)[] | null;
  includeOnline?: boolean;
  recallSpectators?: boolean;
};

export type ResetRoomResult = {
  ok: true;
  keptCount: number;
  pruneTargets: number;
};

export type RestartRoundRequest = QuickStartRequest &
  Pick<ResetRoomRequest, "roundIds" | "onlineUids">;

export type EvaluateRequest = {
  roomId: string;
  list: string[];
  revealDelayMs?: number;
};

export type SubmitCustomTopicRequest = QuickStartRequest & {
  customTopic: string;
  shouldAutoStart: boolean;
};

// ============================================================================
// NextRound: 「次のゲーム」専用 API 用の型定義
// ============================================================================

export type NextRoundRequest = {
  roomId: string;
  topicType?: string | null;
  customTopic?: string | null;
  presenceInfo?: PresenceInfo;
};

export type NextRoundApiResult =
  | {
      ok: true;
      requestId: string;
      round: number;
      playerCount: number;
      topic: string | null;
      topicType: string | null;
    }
  | {
      ok: false;
      requestId: string;
      reason: "forbidden" | "invalid_status" | "no_players" | "rate-limited" | "api-error";
      status?: number;
      url?: string;
      method?: string;
      details?: unknown;
      errorCode?: string;
      errorMessage?: string;
    };

const FALLBACK_TOPIC_TYPE = "通常版";

const normalizeTopicType = (input?: string | null): string => {
  if (!input || typeof input !== "string") return FALLBACK_TOPIC_TYPE;
  const trimmed = input.trim();
  if (!trimmed) return FALLBACK_TOPIC_TYPE;
  return trimmed;
};

function safeActiveCounts(info?: PresenceInfo) {
  const basePlayers =
    typeof info?.playerCount === "number" && Number.isFinite(info.playerCount)
      ? Math.max(0, info.playerCount)
      : 0;
  const onlineCount = Array.isArray(info?.onlineUids)
    ? info.onlineUids.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      ).length
    : undefined;
  const activeCount = calculateEffectiveActive(onlineCount, basePlayers, {
    maxDrift: 3,
  });
  return { activeCount, onlineCount, playerCount: basePlayers };
}

type HostActionsOverrides = {
  apiNextRound?: typeof apiNextRound;
};

export function createHostActionsController(
  session?: HostSessionProvider,
  overrides?: HostActionsOverrides
) {
  const apiNextRoundImpl = overrides?.apiNextRound ?? apiNextRound;
  const resolveSessionId = async (): Promise<string | null> => {
    try {
      const cached = session?.getSessionId?.() ?? null;
      if (cached) return cached;
      if (session?.ensureSession) {
        return (await session.ensureSession()) ?? null;
      }
    } catch (error) {
      traceError("ui.host.session.resolve", error);
    }
    return null;
  };

  const quickStartWithTopic = async (
    req: QuickStartRequest
  ): Promise<QuickStartResult> => {
    const { roomId, presenceInfo, currentTopic, customTopic } = req;
    const startRequestId = generateRequestId();
    const sessionId = await resolveSessionId();
    const { activeCount, onlineCount, playerCount } = safeActiveCounts(
      presenceInfo
    );
    const auth = getAuth();

    if (auth?.currentUser) {
      try {
        // まずキャッシュから取得し、失敗や期限切れだけ強制リフレッシュ
        const cached = await auth.currentUser.getIdToken(/* forceRefresh */ false);
        if (!cached) {
          await auth.currentUser.getIdToken(true);
        }
      } catch (error) {
        traceError("ui.host.quickStart.authRefresh", error, { roomId });
        return {
          ok: false,
          requestId: startRequestId,
          reason: "auth-error",
          activeCount,
          onlineCount,
          playerCount,
        };
      }
    }
    const presenceReady = presenceInfo?.presenceReady ?? false;
    // 2人以下のデバッグ/少人数は presence 待ちを緩和、それ以外は必須
    const skipPresence = activeCount <= 2;
    const shouldEnforcePresence = !skipPresence;

    if (shouldEnforcePresence && !presenceReady) {
      return {
        ok: false,
        requestId: startRequestId,
        reason: "presence-not-ready",
        activeCount,
        onlineCount,
        playerCount,
      };
    }

    let effectiveType = normalizeTopicType(req.defaultTopicType);
    let topic: string | null = currentTopic ?? null;
    let hostId: string | null = null;

    if (db) {
      try {
        const ref = doc(db, "rooms", roomId);
        // できるだけサーバー最新を読んでステータスずれを防ぐ。失敗したらキャッシュでフォールバック。
        const snap = await getDocFromServer(ref).catch(() => getDoc(ref));
        const data = snap.data() as RoomDoc | undefined;
        if (data?.options?.defaultTopicType) {
          effectiveType = normalizeTopicType(data.options.defaultTopicType);
        }
        if (typeof data?.hostId === "string") {
          hostId = data.hostId;
        }
        if (typeof data?.topic === "string") {
          topic = data.topic;
        } else if (data?.topic === null) {
          topic = null;
        }
        // allowFromFinished が true の場合は reveal/finished からの開始も許可
        // allowFromClue が true の場合は clue からの開始も許可（リトライ時のレース条件対策）
        const allowFromFinished = req.allowFromFinished ?? false;
        const allowFromClue = req.allowFromClue ?? false;
        const validStatuses: string[] = ["waiting"];
        if (allowFromFinished) {
          validStatuses.push("reveal", "finished");
        }
        if (allowFromClue) {
          validStatuses.push("clue");
        }
        if (typeof data?.status === "string" && !validStatuses.includes(data.status)) {
          return {
            ok: false,
            requestId: startRequestId,
            reason: "not-waiting",
            roomStatus: data.status,
            topicType: effectiveType,
            topic,
            activeCount,
            onlineCount,
            playerCount,
          };
        }
      } catch {
        // snapshot fetch failure is non-fatal
      }
    }

    const authUid = getAuth()?.currentUser?.uid ?? null;
    if (hostId && authUid && hostId !== authUid) {
      return {
        ok: false,
        requestId: startRequestId,
        reason: "host-mismatch",
        hostId,
        topicType: effectiveType,
        topic,
        activeCount,
      };
    }

    if (
      effectiveType === "カスタム" &&
      !(typeof customTopic === "string" && customTopic.trim().length > 0) &&
      !(typeof topic === "string" && topic.trim().length > 0)
    ) {
      return {
        ok: false,
        requestId: startRequestId,
        reason: "needs-custom-topic",
        topicType: effectiveType,
        topic,
        activeCount,
      };
    }

    let success = false;
    try {
      const relaxForNonWaiting =
        typeof req.roomStatus === "string" && req.roomStatus !== "waiting";
      // 一本化後のレースを極力減らすため、デフォルトで寛容に進行中ステータスも許可する。
      const allowFromFinished = req.allowFromFinished ?? true;
      // clue 状態の再開始は、waiting 以外の状態のときだけ緩和。
      const allowFromClue = req.allowFromClue ?? relaxForNonWaiting;
      traceAction("ui.host.quickStart.api", {
        roomId,
        requestId: startRequestId,
        type: effectiveType,
        skipPresence: skipPresence ? "1" : "0",
        allowFromFinished: allowFromFinished ? "1" : "0",
        allowFromClue: allowFromClue ? "1" : "0",
        roomStatus: req.roomStatus ?? undefined,
        relaxForNonWaiting: relaxForNonWaiting ? "1" : "0",
      });

      await apiStartGame(roomId, {
        allowFromFinished,
        allowFromClue,
        requestId: startRequestId,
        sessionId,
        autoDeal: true,
        topicType: effectiveType,
        customTopic: customTopic ?? topic ?? undefined,
        presenceUids:
          Array.isArray(presenceInfo?.onlineUids) && presenceInfo.onlineUids.length > 0
            ? presenceInfo.onlineUids.filter(
                (id): id is string => typeof id === "string" && id.trim().length > 0
              )
            : undefined,
      });

      try {
        postRoundReset(roomId);
      } catch {}

      success = true;
      return {
        ok: true,
        requestId: startRequestId,
        topicType: effectiveType,
        topic: topic ?? null,
        assignedCount: undefined,
        durationMs: undefined,
        activeCount,
        skipPresence,
      };
    } catch (error) {
      const apiError = error as ApiError;
      const code = apiError?.code ?? null;
      const status = typeof apiError?.status === "number" ? apiError.status : undefined;
      const url = typeof apiError?.url === "string" ? apiError.url : undefined;
      const method =
        typeof apiError?.method === "string" ? apiError.method : undefined;
      const details = apiError?.details;
      const message = error instanceof Error ? error.message : String(error ?? "");
      traceError("ui.host.quickStart.error", error, { roomId, code });
      if (code === "rate_limited") {
        return {
          ok: false,
          requestId: startRequestId,
          reason: "rate-limited",
          topicType: effectiveType,
          topic,
          activeCount,
          onlineCount,
          playerCount,
          status,
          url,
          method,
          details,
          errorCode: code,
          errorMessage: message,
        };
      }
      if (code === "invalid_status") {
        return {
          ok: false,
          requestId: startRequestId,
          reason: "not-waiting",
          roomStatus: req.roomStatus ?? null,
          topicType: effectiveType,
          topic,
          activeCount,
          onlineCount,
          playerCount,
          status,
          url,
          method,
          details,
          errorCode: code,
          errorMessage: message,
        };
      }
      if (code === "forbidden") {
        return {
          ok: false,
          requestId: startRequestId,
          reason: "host-mismatch",
          hostId,
          topicType: effectiveType,
          topic,
          activeCount,
          onlineCount,
          playerCount,
          status,
          url,
          method,
          details,
          errorCode: code,
          errorMessage: message,
        };
      }
      return {
        ok: false,
        requestId: startRequestId,
        reason: "callable-error",
        topicType: effectiveType,
        topic,
        activeCount,
        onlineCount,
        playerCount,
        status,
        url,
        method,
        details,
        errorCode: code ?? undefined,
        errorMessage: message,
      };
    } finally {
      if (success) {
        try {
          if (typeof window !== "undefined") {
            delete (window as { __ITO_LAST_RESET?: number }).__ITO_LAST_RESET;
          }
        } catch {}
      }
    }
  };

  const resetRoomToWaitingWithPrune = async (
    req: ResetRoomRequest
  ): Promise<ResetRoomResult> => {
    const resetRequestId = generateRequestId();
    const keepSet = new Set<string>();
    if (Array.isArray(req.roundIds)) {
      req.roundIds.forEach((id) => {
        if (typeof id === "string" && id.trim()) keepSet.add(id);
      });
    }
    if (req.includeOnline && Array.isArray(req.onlineUids)) {
      req.onlineUids.forEach((id) => {
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

    let pruneTargets = 0;
    if (shouldPrune && Array.isArray(req.roundIds) && req.roundIds.length > 0) {
      const targets = req.roundIds.filter((id) => !keepSet.has(id));
      pruneTargets = targets.length;
      if (targets.length > 0) {
        try {
          const auth = getAuth();
          const user = auth.currentUser;
          const token = await user?.getIdToken();
          if (token && user?.uid) {
            await fetch(`/api/rooms/${req.roomId}/prune`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token, callerUid: user.uid, targets, clientVersion: APP_VERSION }),
            }).catch(() => {});
          }
        } catch {
          // prune failures are non-fatal
        }
      }
    }

    traceAction("ui.room.reset", {
      roomId: req.roomId,
      keep: String(keep.length),
      prune: shouldPrune ? "1" : "0",
      recall: req.recallSpectators ? "1" : "0",
    });

    const sessionId = await resolveSessionId();

    await resetRoomWithPrune(req.roomId, keep, {
      notifyChat: true,
      recallSpectators: req.recallSpectators ?? true,
      requestId: resetRequestId,
      sessionId,
    });

    try {
      postRoundReset(req.roomId);
    } catch {}

    return { ok: true, keptCount: keep.length, pruneTargets };
  };

  const restartRound = async (
    req: RestartRoundRequest
  ): Promise<QuickStartResult> => {
    // 「次のゲーム」フローでは reset を実行しつつ、
    // allowFromFinished=true で直接 reveal/finished → clue に遷移可能にする
    // これにより Firestore 伝播のレース条件を回避
    await resetRoomToWaitingWithPrune({
      roomId: req.roomId,
      roundIds: req.roundIds,
      onlineUids: req.onlineUids,
      includeOnline: false,
      recallSpectators: false,
    });
    return quickStartWithTopic({
      ...req,
      allowFromFinished: true,
      allowFromClue: true,
    });
  };

  const evaluateSortedOrder = async (
    req: EvaluateRequest
  ): Promise<void> => {
    if (req.list.length === 0) return;
    await submitSortedOrder(req.roomId, req.list);
    const delay = req.revealDelayMs ?? 0;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    await beginRevealPending(req.roomId);
  };

  const submitCustomTopicAndStartIfNeeded = async (
    req: SubmitCustomTopicRequest
  ): Promise<QuickStartResult | { ok: true; started: false } | QuickStartResult> => {
    const topic = req.customTopic.trim();
    await topicControls.setCustomTopic(req.roomId, topic);

    if (!req.shouldAutoStart) {
      return { ok: true, started: false } as const;
    }

    return quickStartWithTopic({
      ...req,
      defaultTopicType: "カスタム",
      currentTopic: topic,
      customTopic: topic,
    });
  };

  // ============================================================================
  // nextRound: 「次のゲーム」専用 API を呼び出す
  // ============================================================================
  // reset + start + topic選択 + deal をアトミックに実行する。
  // 従来の restartRound (= reset + quickStartWithTopic) を置き換える。
  // ============================================================================
  const nextRound = async (req: NextRoundRequest): Promise<NextRoundApiResult> => {
    const { roomId, topicType, customTopic } = req;
    const requestId = generateRequestId();
    const sessionId = await resolveSessionId();

    traceAction("ui.host.nextRound.api", {
      roomId,
      requestId,
      topicType: topicType ?? "default",
      hasCustomTopic: customTopic ? "1" : "0",
    });

    try {
      const presenceUids =
        Array.isArray(req.presenceInfo?.onlineUids) && req.presenceInfo.onlineUids.length > 0
          ? req.presenceInfo.onlineUids.filter(
              (id): id is string => typeof id === "string" && id.trim().length > 0
            )
          : undefined;
      const result = await apiNextRoundImpl(roomId, {
        topicType,
        customTopic,
        requestId,
        sessionId,
        presenceUids,
      });

      // broadcast でラウンドリセットを通知
      try {
        postRoundReset(roomId);
      } catch {
        // broadcast failure is non-fatal
      }

      return {
        ok: true,
        requestId,
        round: result.round,
        playerCount: result.playerCount,
        topic: result.topic,
        topicType: result.topicType,
      };
    } catch (error) {
      const apiError = error as ApiError;
      const code = apiError?.code ?? null;
      const status = typeof apiError?.status === "number" ? apiError.status : undefined;
      const url = typeof apiError?.url === "string" ? apiError.url : undefined;
      const method = typeof apiError?.method === "string" ? apiError.method : undefined;
      const details = apiError?.details;
      const message = error instanceof Error ? error.message : String(error ?? "");
      traceError("ui.host.nextRound.error", error, { roomId, code });

      if (code === "forbidden") {
        return {
          ok: false,
          requestId,
          reason: "forbidden",
          status,
          url,
          method,
          details,
          errorCode: code,
          errorMessage: message,
        };
      }
      if (code === "rate_limited") {
        return {
          ok: false,
          requestId,
          reason: "rate-limited",
          status,
          url,
          method,
          details,
          errorCode: code,
          errorMessage: message,
        };
      }
      if (code === "invalid_status") {
        return {
          ok: false,
          requestId,
          reason: "invalid_status",
          status,
          url,
          method,
          details,
          errorCode: code,
          errorMessage: message,
        };
      }
      if (code === "no_players") {
        return {
          ok: false,
          requestId,
          reason: "no_players",
          status,
          url,
          method,
          details,
          errorCode: code,
          errorMessage: message,
        };
      }
      return {
        ok: false,
        requestId,
        reason: "api-error",
        status,
        url,
        method,
        details,
        errorCode: code ?? undefined,
        errorMessage: message,
      };
    }
  };

  return {
    quickStartWithTopic,
    resetRoomToWaitingWithPrune,
    restartRound,
    evaluateSortedOrder,
    submitCustomTopicAndStartIfNeeded,
    nextRound,
  };
}

export type HostActionsController = ReturnType<
  typeof createHostActionsController
>;
