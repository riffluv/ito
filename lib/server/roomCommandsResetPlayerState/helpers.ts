import type { PlayerDoc } from "@/lib/types";

export function resolveTargetPlayerId(params: { uid: string; playerId?: string | null }): string {
  const raw = typeof params.playerId === "string" ? params.playerId.trim() : "";
  return raw ? raw : params.uid;
}

export function shouldRequireHostForReset(params: { uid: string; targetId: string }): boolean {
  return params.targetId !== params.uid;
}

export function buildResetPlayerStateUpdate(params: {
  lastSeen: unknown;
}): Partial<PlayerDoc> {
  return {
    number: null,
    clue1: "",
    ready: false,
    orderIndex: 0,
    lastSeen: params.lastSeen as unknown as PlayerDoc["lastSeen"],
  };
}
