import { APP_VERSION } from "@/lib/constants/appVersion";

import { getIdTokenOrThrow, postJson } from "./core";

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

