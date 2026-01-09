import { APP_VERSION } from "@/lib/constants/appVersion";

import { getIdTokenOrThrow, postJson } from "./core";

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

