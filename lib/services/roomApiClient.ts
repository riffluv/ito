import { auth } from "@/lib/firebase/client";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";

export type ApiError = Error & {
  code?: string;
  status?: number;
  details?: unknown;
  url?: string;
  method?: string;
};

const toApiError = (
  code: string | undefined,
  status: number,
  details: unknown,
  meta?: { url?: string; method?: string }
): ApiError => {
  const err = new Error(code ?? "api_error") as ApiError;
  err.code = code;
  err.status = status;
  err.details = details;
  err.url = meta?.url;
  err.method = meta?.method;
  return err;
};

function classifyConflict(code: string | undefined): "room/join/version-mismatch" | "room/create/update-required" | "invalid_status" | "other" {
  if (code === "room/join/version-mismatch") return "room/join/version-mismatch";
  if (code === "room/create/update-required" || code === "room/create/version-mismatch") {
    return "room/create/update-required";
  }
  if (code === "invalid_status" || code === "not_waiting") return "invalid_status";
  return "other";
}

async function getIdTokenOrThrow(reason?: string): Promise<string> {
  const user = auth?.currentUser;
  if (!user) {
    throw toApiError("unauthorized", 401, { reason });
  }
  try {
    return await user.getIdToken();
  } catch (error) {
    throw toApiError("unauthorized", 401, { reason, error });
  }
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  });

  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const code = typeof (json as { error?: unknown })?.error === "string" ? (json as { error: string }).error : undefined;
    if (res.status === 409) {
      const category = classifyConflict(code);
      traceAction("api.conflict.409", { url, code: code ?? "unknown", category });
      setMetric("api", "last409", `${category}:${code ?? "unknown"}@${url}`);
    }
    throw toApiError(code, res.status, json, { url, method: "POST" });
  }

  return json as T;
}

export async function apiCreateRoom(payload: {
  roomName: string;
  displayName: string;
  displayMode?: string | null;
  options?: Record<string, unknown>;
  passwordHash?: string | null;
  passwordSalt?: string | null;
  passwordVersion?: number | null;
}): Promise<{ roomId: string; appVersion: string }> {
  const token = await getIdTokenOrThrow("create-room");
  return postJson("/api/rooms/create", {
    ...payload,
    token,
    clientVersion: APP_VERSION,
  });
}

export async function apiJoinRoom(params: { roomId: string; displayName: string | null }): Promise<{ joined: boolean; avatar: string | null }> {
  const token = await getIdTokenOrThrow("join-room");
  return postJson(`/api/rooms/${params.roomId}/join`, {
    token,
    displayName: params.displayName,
    clientVersion: APP_VERSION,
  });
}

export async function apiLeaveRoom(roomId: string): Promise<void> {
  const user = auth?.currentUser;
  if (!user) {
    throw toApiError("unauthorized", 401, { reason: "leave-room" });
  }
  const token = await getIdTokenOrThrow("leave-room");
  await postJson(`/api/rooms/${roomId}/leave`, {
    uid: user.uid,
    token,
    displayName: user.displayName ?? null,
    clientVersion: APP_VERSION,
  });
}

export async function apiReady(roomId: string, ready: boolean): Promise<void> {
  const token = await getIdTokenOrThrow("ready");
  await postJson(`/api/rooms/${roomId}/ready`, { token, ready, clientVersion: APP_VERSION });
}

export async function apiSubmitClue(roomId: string, clue: string): Promise<void> {
  const token = await getIdTokenOrThrow("submit-clue");
  await postJson(`/api/rooms/${roomId}/submit-clue`, { token, clue, clientVersion: APP_VERSION });
}

export async function apiSubmitOrder(roomId: string, list: string[]): Promise<void> {
  const token = await getIdTokenOrThrow("submit-order");
  await postJson(`/api/rooms/${roomId}/submit-order`, { token, list, clientVersion: APP_VERSION });
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
  await postJson(`/api/rooms/${roomId}/start`, {
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
  });
}

export async function apiResetRoom(
  roomId: string,
  recallSpectators: boolean,
  requestId: string,
  sessionId?: string | null
): Promise<void> {
  const token = await getIdTokenOrThrow("reset-room");
  await postJson(`/api/rooms/${roomId}/reset`, {
    token,
    clientVersion: APP_VERSION,
    recallSpectators,
    requestId,
    sessionId: sessionId ?? undefined,
  });
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
};

export async function apiNextRound(roomId: string, opts: NextRoundOptions): Promise<NextRoundResult> {
  const token = await getIdTokenOrThrow("next-round");
  return postJson(`/api/rooms/${roomId}/next-round`, {
    token,
    clientVersion: APP_VERSION,
    topicType: opts?.topicType ?? undefined,
    customTopic: opts?.customTopic ?? undefined,
    requestId: opts.requestId,
    sessionId: opts.sessionId ?? undefined,
    presenceUids: opts.presenceUids ?? undefined,
  });
}

export async function apiDealNumbers(
  roomId: string,
  opts: { skipPresence?: boolean; requestId: string; sessionId?: string | null; presenceUids?: string[] | null }
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
  return postJson(`/api/rooms/${params.roomId}/proposal`, {
    token,
    playerId: params.playerId,
    action: params.action,
    targetIndex: params.targetIndex ?? null,
    clientVersion: APP_VERSION,
  });
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
  await postJson(`/api/rooms/${roomId}/continue`, { token, clientVersion: APP_VERSION });
}

export async function apiFinalizeReveal(roomId: string): Promise<void> {
  const token = await getIdTokenOrThrow("finalize-reveal");
  await postJson(`/api/rooms/${roomId}/finalize`, { token, clientVersion: APP_VERSION });
}

export async function apiPruneProposal(roomId: string, eligibleIds: string[]): Promise<void> {
  const token = await getIdTokenOrThrow("prune-proposal");
  await postJson(`/api/rooms/${roomId}/prune-proposal`, {
    token,
    eligibleIds,
    clientVersion: APP_VERSION,
  });
}

export async function apiUpdateRoomOptions(params: {
  roomId: string;
  resolveMode?: string | null;
  defaultTopicType?: string | null;
}): Promise<void> {
  const token = await getIdTokenOrThrow("update-room-options");
  await postJson(`/api/rooms/${params.roomId}/options`, {
    token,
    resolveMode: params.resolveMode ?? null,
    defaultTopicType: params.defaultTopicType ?? null,
    clientVersion: APP_VERSION,
  });
}

export async function apiCastMvpVote(roomId: string, targetId: string | null): Promise<void> {
  const token = await getIdTokenOrThrow("mvp-vote");
  await postJson(`/api/rooms/${roomId}/mvp`, {
    token,
    targetId,
    clientVersion: APP_VERSION,
  });
}

export async function apiUpdatePlayerProfile(params: {
  roomId: string;
  playerId?: string | null;
  name?: string | null;
  avatar?: string | null;
}): Promise<void> {
  const token = await getIdTokenOrThrow("update-player-profile");
  await postJson(`/api/rooms/${params.roomId}/players/profile`, {
    token,
    playerId: params.playerId ?? null,
    name: params.name ?? null,
    avatar: params.avatar ?? null,
    clientVersion: APP_VERSION,
  });
}

export async function apiResetPlayerState(params: { roomId: string; playerId?: string | null }): Promise<void> {
  const token = await getIdTokenOrThrow("reset-player-state");
  await postJson(`/api/rooms/${params.roomId}/players/reset`, {
    token,
    playerId: params.playerId ?? null,
    clientVersion: APP_VERSION,
  });
}

export async function apiSelectTopicCategory(roomId: string, type: string): Promise<void> {
  const token = await getIdTokenOrThrow("topic-select");
  await postJson(`/api/rooms/${roomId}/topic`, {
    token,
    action: "select",
    type,
    clientVersion: APP_VERSION,
  });
}

export async function apiShuffleTopic(roomId: string, type: string): Promise<void> {
  const token = await getIdTokenOrThrow("topic-shuffle");
  await postJson(`/api/rooms/${roomId}/topic`, {
    token,
    action: "shuffle",
    type,
    clientVersion: APP_VERSION,
  });
}

export async function apiSetCustomTopic(roomId: string, text: string): Promise<void> {
  const token = await getIdTokenOrThrow("topic-custom");
  await postJson(`/api/rooms/${roomId}/topic`, {
    token,
    action: "custom",
    text,
    clientVersion: APP_VERSION,
  });
}

export async function apiResetTopic(roomId: string): Promise<void> {
  const token = await getIdTokenOrThrow("topic-reset");
  await postJson(`/api/rooms/${roomId}/topic`, {
    token,
    action: "reset",
    clientVersion: APP_VERSION,
  });
}

export async function apiSetRevealPending(roomId: string, pending: boolean): Promise<void> {
  const token = await getIdTokenOrThrow("reveal-pending");
  await postJson(`/api/rooms/${roomId}/reveal-pending`, {
    token,
    pending,
    clientVersion: APP_VERSION,
  });
}

export async function apiSetRoundPreparing(roomId: string, active: boolean): Promise<void> {
  const token = await getIdTokenOrThrow("round-preparing");
  await postJson(`/api/rooms/${roomId}/round-preparing`, {
    token,
    active,
    clientVersion: APP_VERSION,
  });
}
