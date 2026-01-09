import {
  submitSortedOrder,
  topicControls,
} from "@/lib/game/service";
import {
  apiStartGame,
  apiNextRound,
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
  createResetRoomToWaitingWithPrune,
  type ResetRoomRequest,
  type ResetRoomResult,
} from "@/lib/host/resetRoomToWaitingWithPrune";
import {
  createRoomSnapshotFetcher,
  createSessionResolver,
  type HostSessionProvider,
} from "@/lib/host/hostActionsControllerRuntime";
import { sleep } from "@/lib/host/hostActionsControllerHelpers";

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
  const resolveSessionId = createSessionResolver(session);
  const fetchRoomSnapshot = createRoomSnapshotFetcher();

  const quickStartWithTopic = createQuickStartWithTopic({
    resolveSessionId,
    fetchRoomSnapshot,
    apiStartGameImpl: apiStartGame,
  });

  const resetRoomToWaitingWithPrune = createResetRoomToWaitingWithPrune({
    resolveSessionId,
    fetchRoomSnapshot,
  });

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
      await sleep(delay);
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
export type { ResetRoomRequest, ResetRoomResult };
