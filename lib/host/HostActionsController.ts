import { db } from "@/lib/firebase/client";
import {
  resetRoomWithPrune,
  submitSortedOrder,
  topicControls,
} from "@/lib/game/service";
import { postRoundReset } from "@/lib/utils/broadcast";
import { traceAction, traceError } from "@/lib/utils/trace";
import type { RoomDoc } from "@/lib/types";
import { APP_VERSION } from "@/lib/constants/appVersion";
import {
  apiStartGame,
  apiNextRound,
  type ApiError,
} from "@/lib/services/roomApiClient";
import {
  createNextRound,
  type NextRoundApiResult,
  type NextRoundRequest,
} from "@/lib/host/nextRound";
import {
  createQuickStartWithTopic,
  type QuickStartRequest,
  type QuickStartResult,
} from "@/lib/host/quickStartWithTopic";
import {
  generateRequestId,
  getErrorMessage,
  isTransientNetworkError,
  sleep,
} from "@/lib/host/hostActionsControllerHelpers";
import { getAuth } from "firebase/auth";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";

type HostSessionProvider = {
  getSessionId?: () => string | null;
  ensureSession?: () => Promise<string | null>;
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

  const fetchRoomSnapshot = async (roomId: string): Promise<RoomDoc | null> => {
    if (!db) return null;
    try {
      const ref = doc(db, "rooms", roomId);
      const snap = await getDocFromServer(ref).catch(() => getDoc(ref));
      return (snap.data() as RoomDoc | undefined) ?? null;
    } catch (error) {
      traceError("ui.host.room.read", error, { roomId });
      return null;
    }
  };

  const quickStartWithTopic = createQuickStartWithTopic({
    resolveSessionId,
    fetchRoomSnapshot,
    apiStartGameImpl: apiStartGame,
  });

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

    const runReset = () =>
      resetRoomWithPrune(req.roomId, keep, {
        notifyChat: true,
        recallSpectators: req.recallSpectators ?? true,
        requestId: resetRequestId,
        sessionId,
      });

    const confirmResetApplied = async () => {
      const room = await fetchRoomSnapshot(req.roomId);
      return (
        room?.status === "waiting" &&
        typeof room.resetRequestId === "string" &&
        room.resetRequestId === resetRequestId
      );
    };

    try {
      await runReset();
    } catch (error) {
      if (!isTransientNetworkError(error)) {
        throw error;
      }
      traceAction("ui.room.reset.retry", {
        roomId: req.roomId,
        requestId: resetRequestId,
        message: getErrorMessage(error),
      });
      await sleep(650);
      try {
        await runReset();
      } catch (retryError) {
        const code = (retryError as Partial<ApiError> | null)?.code;
        if (
          (code === "rate_limited" || isTransientNetworkError(retryError)) &&
          (await confirmResetApplied())
        ) {
          traceAction("ui.room.reset.retry.applied", {
            roomId: req.roomId,
            requestId: resetRequestId,
          });
        } else {
          throw retryError;
        }
      }
    }

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
  const nextRound = createNextRound({
    apiNextRoundImpl,
    resolveSessionId,
  });

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

export type { NextRoundApiResult, NextRoundRequest };
export type { QuickStartRequest, QuickStartResult };
