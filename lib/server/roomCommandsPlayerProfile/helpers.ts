import type { PlayerDoc } from "@/lib/types";

export function resolveTargetPlayerId(params: {
  uid: string;
  playerId?: string | null;
}): string {
  const raw = typeof params.playerId === "string" ? params.playerId.trim() : "";
  return raw ? raw : params.uid;
}

export function shouldRequireHostForProfileUpdate(params: {
  uid: string;
  targetId: string;
}): boolean {
  return params.targetId !== params.uid;
}

export function buildPlayerProfileUpdates(params: {
  lastSeen: unknown;
  name?: string | null;
  avatar?: string | null;
  sanitizeName: (value: string) => string;
}): Partial<PlayerDoc> & Record<string, unknown> {
  const updates: Partial<PlayerDoc> & Record<string, unknown> = {
    lastSeen: params.lastSeen as unknown as PlayerDoc["lastSeen"],
  };
  if (typeof params.name === "string" && params.name.trim().length > 0) {
    updates.name = params.sanitizeName(params.name);
  }
  if (typeof params.avatar === "string" && params.avatar.trim().length > 0) {
    updates.avatar = params.avatar;
  }
  return updates;
}
