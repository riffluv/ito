import { APP_VERSION } from "@/lib/constants/appVersion";

import { getIdTokenOrThrow, postJson, postJsonWithRetry } from "./core";
import { dispatchRoomSyncPatch, type RoomSyncPatch } from "./syncPatch";

export async function apiSubmitClue(roomId: string, clue: string): Promise<void> {
  const token = await getIdTokenOrThrow("submit-clue");
  await postJson(`/api/rooms/${roomId}/submit-clue`, {
    token,
    clue,
    clientVersion: APP_VERSION,
  });
}

export async function apiSubmitOrder(roomId: string, list: string[]): Promise<void> {
  const token = await getIdTokenOrThrow("submit-order");
  await postJson(`/api/rooms/${roomId}/submit-order`, {
    token,
    list,
    clientVersion: APP_VERSION,
  });
}

export async function apiStartGame(
  roomId: string,
  opts: {
    allowFromFinished?: boolean;
    allowFromClue?: boolean;
    requestId: string;
    sessionId?: string | null;
    autoDeal?: boolean;
    topicType?: string | null;
    customTopic?: string | null;
    presenceUids?: string[] | null;
  }
): Promise<void> {
  const token = await getIdTokenOrThrow("start-game");
  const result = await postJson<{ ok: true; sync?: unknown }>(
    `/api/rooms/${roomId}/start`,
    {
      token,
      clientVersion: APP_VERSION,
      allowFromFinished: opts?.allowFromFinished ?? false,
      allowFromClue: opts?.allowFromClue ?? false,
      requestId: opts?.requestId,
      sessionId: opts?.sessionId ?? undefined,
      autoDeal: opts?.autoDeal ?? false,
      topicType: opts?.topicType ?? undefined,
      customTopic: opts?.customTopic ?? undefined,
      presenceUids: opts?.presenceUids ?? undefined,
    }
  );
  dispatchRoomSyncPatch(result?.sync);
}

export async function apiResetRoom(
  roomId: string,
  recallSpectators: boolean,
  requestId: string,
  sessionId?: string | null
): Promise<void> {
  const token = await getIdTokenOrThrow("reset-room");
  const result = await postJson<{ ok: true; sync?: unknown }>(
    `/api/rooms/${roomId}/reset`,
    {
      token,
      clientVersion: APP_VERSION,
      recallSpectators,
      requestId,
      sessionId: sessionId ?? undefined,
    }
  );
  dispatchRoomSyncPatch(result?.sync);
}

// ============================================================================
// apiNextRound: 「次のゲーム」専用 API
// ============================================================================
// reset + start + topic選択 + deal をアトミックに実行する。
// 従来の restartGame → resetGame + quickStart の複雑な経路を置き換える。
// ============================================================================

export type NextRoundOptions = {
  topicType?: string | null;
  customTopic?: string | null;
  requestId: string;
  sessionId?: string | null;
  presenceUids?: string[] | null;
};

export type NextRoundResult = {
  ok: true;
  round: number;
  playerCount: number;
  topic: string | null;
  topicType: string | null;
  sync?: RoomSyncPatch;
};

export async function apiNextRound(
  roomId: string,
  opts: NextRoundOptions
): Promise<NextRoundResult> {
  const token = await getIdTokenOrThrow("next-round");
  const result = await postJson<NextRoundResult>(`/api/rooms/${roomId}/next-round`, {
    token,
    clientVersion: APP_VERSION,
    topicType: opts?.topicType ?? undefined,
    customTopic: opts?.customTopic ?? undefined,
    requestId: opts.requestId,
    sessionId: opts.sessionId ?? undefined,
    presenceUids: opts.presenceUids ?? undefined,
  });
  dispatchRoomSyncPatch(result?.sync);
  return result;
}

export async function apiDealNumbers(
  roomId: string,
  opts: {
    skipPresence?: boolean;
    requestId: string;
    sessionId?: string | null;
    presenceUids?: string[] | null;
  }
): Promise<{ count: number }> {
  const token = await getIdTokenOrThrow("deal-numbers");
  return postJson(`/api/rooms/${roomId}/deal`, {
    token,
    clientVersion: APP_VERSION,
    skipPresence: opts?.skipPresence ?? false,
    requestId: opts.requestId,
    sessionId: opts.sessionId ?? undefined,
    presenceUids: opts.presenceUids ?? undefined,
  });
}

export async function apiMutateProposal(params: {
  roomId: string;
  playerId: string;
  action: "add" | "remove" | "move";
  targetIndex?: number | null;
}): Promise<{ status: "ok" | "noop" | "missing-deal" }> {
  const token = await getIdTokenOrThrow("proposal-mutate");
  return postJsonWithRetry(
    `/api/rooms/${params.roomId}/proposal`,
    {
      token,
      playerId: params.playerId,
      action: params.action,
      targetIndex: params.targetIndex ?? null,
      clientVersion: APP_VERSION,
    },
    { retries: 2, baseDelayMs: 140 }
  );
}

export async function apiCommitPlay(roomId: string, playerId: string): Promise<void> {
  const token = await getIdTokenOrThrow("commit-play");
  await postJson(`/api/rooms/${roomId}/commit-play`, {
    token,
    playerId,
    clientVersion: APP_VERSION,
  });
}

export async function apiContinueAfterFail(roomId: string): Promise<void> {
  const token = await getIdTokenOrThrow("continue-after-fail");
  await postJson(`/api/rooms/${roomId}/continue`, {
    token,
    clientVersion: APP_VERSION,
  });
}

export async function apiFinalizeReveal(roomId: string): Promise<void> {
  const token = await getIdTokenOrThrow("finalize-reveal");
  await postJson(`/api/rooms/${roomId}/finalize`, {
    token,
    clientVersion: APP_VERSION,
  });
}

export async function apiPruneProposal(roomId: string, eligibleIds: string[]): Promise<void> {
  const token = await getIdTokenOrThrow("prune-proposal");
  await postJson(`/api/rooms/${roomId}/prune-proposal`, {
    token,
    eligibleIds,
    clientVersion: APP_VERSION,
  });
}

