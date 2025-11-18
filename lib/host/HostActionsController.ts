import { db } from "@/lib/firebase/client";
import { functions } from "@/lib/firebase/functions";
import {
  beginRevealPending,
  resetRoomWithPrune,
  setRoundPreparing,
  submitSortedOrder,
  topicControls,
} from "@/lib/game/service";
import { postRoundReset } from "@/lib/utils/broadcast";
import { calculateEffectiveActive } from "@/lib/utils/playerCount";
import { traceAction, traceError } from "@/lib/utils/trace";
import type { RoomDoc } from "@/lib/types";
import { getAuth } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

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
};

export type QuickStartResult =
  | {
      ok: true;
      topicType: string;
      topic: string | null;
      assignedCount?: number;
      durationMs?: number;
      activeCount: number;
      skipPresence: boolean;
    }
  | {
      ok: false;
      reason:
        | "presence-not-ready"
        | "host-mismatch"
        | "needs-custom-topic"
        | "functions-unavailable";
      topicType?: string;
      topic?: string | null;
      hostId?: string | null;
      activeCount?: number;
      onlineCount?: number;
      playerCount?: number;
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

async function toggleRoundPreparing(roomId: string, value: boolean) {
  try {
    await setRoundPreparing(roomId, value);
  } catch (error) {
    traceError("ui.roundPreparing.sync", error, { roomId, value });
  }
}

export function createHostActionsController() {
  const quickStartWithTopic = async (
    req: QuickStartRequest
  ): Promise<QuickStartResult> => {
    const { roomId, presenceInfo, currentTopic, customTopic } = req;
    const { activeCount, onlineCount, playerCount } = safeActiveCounts(
      presenceInfo
    );
    const presenceReady = presenceInfo?.presenceReady ?? false;
    const skipPresence = activeCount <= 2;
    const shouldEnforcePresence = !skipPresence;

    if (shouldEnforcePresence && !presenceReady) {
      return {
        ok: false,
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
        const snap = await getDoc(doc(db, "rooms", roomId));
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
      } catch {
        // snapshot fetch failure is non-fatal
      }
    }

    const authUid = getAuth()?.currentUser?.uid ?? null;
    if (hostId && authUid && hostId !== authUid) {
      return {
        ok: false,
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
        reason: "needs-custom-topic",
        topicType: effectiveType,
        topic,
        activeCount,
      };
    }

    await toggleRoundPreparing(roomId, true);
    let success = false;
    try {
      const callable = functions
        ? httpsCallable<
            { roomId: string; options?: Record<string, unknown> },
            {
              assignedCount?: number;
              topicType?: string;
              topic?: string | null;
              durationMs?: number;
            }
          >(functions, "quickStart")
        : null;
      if (!callable) {
        return {
          ok: false,
          reason: "functions-unavailable",
          topicType: effectiveType,
          topic,
          activeCount,
        };
      }

      traceAction("ui.host.quickStart", {
        roomId,
        type: effectiveType,
        skipPresence: skipPresence ? "1" : "0",
      });

      const response = await callable({
        roomId,
        options: {
          defaultTopicType: effectiveType,
          skipPresence,
          customTopic: effectiveType === "カスタム" ? customTopic ?? topic : undefined,
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
        postRoundReset(roomId);
      } catch {}

      success = true;
      return {
        ok: true,
        topicType: payload.topicType ?? effectiveType,
        topic: payload.topic ?? topic ?? null,
        assignedCount: payload.assignedCount,
        durationMs: payload.durationMs,
        activeCount,
        skipPresence,
      };
    } catch (error) {
      traceError("ui.host.quickStart.error", error, { roomId });
      throw error;
    } finally {
      await toggleRoundPreparing(roomId, false);
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
              body: JSON.stringify({ token, callerUid: user.uid, targets }),
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

    await resetRoomWithPrune(req.roomId, keep, {
      notifyChat: true,
      recallSpectators: req.recallSpectators ?? true,
    });

    try {
      postRoundReset(req.roomId);
    } catch {}

    return { ok: true, keptCount: keep.length, pruneTargets };
  };

  const restartRound = async (
    req: RestartRoundRequest
  ): Promise<QuickStartResult> => {
    await resetRoomToWaitingWithPrune({
      roomId: req.roomId,
      roundIds: req.roundIds,
      onlineUids: req.onlineUids,
      includeOnline: false,
      recallSpectators: false,
    });
    return quickStartWithTopic(req);
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

  return {
    quickStartWithTopic,
    resetRoomToWaitingWithPrune,
    restartRound,
    evaluateSortedOrder,
    submitCustomTopicAndStartIfNeeded,
    setRoundPreparingFlag: toggleRoundPreparing,
  };
}

export type HostActionsController = ReturnType<
  typeof createHostActionsController
>;
