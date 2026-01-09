import { auth } from "@/lib/firebase/client";
import { APP_VERSION } from "@/lib/constants/appVersion";

import { getIdTokenOrThrow, postJson, toApiError } from "./core";

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

export async function apiCheckRoomCreateVersion(): Promise<{
  appVersion?: string;
  roomVersion?: string;
  clientVersion?: string;
}> {
  return postJson("/api/rooms/version-check", { clientVersion: APP_VERSION });
}

export async function apiJoinRoom(params: {
  roomId: string;
  displayName: string | null;
}): Promise<{ joined: boolean; avatar: string | null }> {
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
  await postJson(`/api/rooms/${roomId}/ready`, {
    token,
    ready,
    clientVersion: APP_VERSION,
  });
}

