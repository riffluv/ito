import { APP_VERSION } from "@/lib/constants/appVersion";

import { getIdTokenOrThrow, postJson } from "./core";

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

export async function apiResetPlayerState(params: {
  roomId: string;
  playerId?: string | null;
}): Promise<void> {
  const token = await getIdTokenOrThrow("reset-player-state");
  await postJson(`/api/rooms/${params.roomId}/players/reset`, {
    token,
    playerId: params.playerId ?? null,
    clientVersion: APP_VERSION,
  });
}

