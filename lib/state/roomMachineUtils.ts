import { sanitizePlayer } from "@/lib/state/sanitize";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { setMetric } from "@/lib/utils/metrics";

export type PlayerWithId = (PlayerDoc & { id: string }) | { id: string; ready?: boolean };
export type SanitizedPlayer = PlayerDoc & { id: string };

export function playerDocsEqual(a: SanitizedPlayer, b: SanitizedPlayer): boolean {
  if (a === b) return true;
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.avatar === b.avatar &&
    a.number === b.number &&
    a.clue1 === b.clue1 &&
    a.ready === b.ready &&
    a.orderIndex === b.orderIndex &&
    (a.uid ?? null) === (b.uid ?? null) &&
    (a.lastSeen ?? null) === (b.lastSeen ?? null) &&
    (a.joinedAt ?? null) === (b.joinedAt ?? null)
  );
}

export function sanitizePlayers(
  players: PlayerWithId[],
  previous?: SanitizedPlayer[]
): SanitizedPlayer[] {
  if (!previous || previous.length === 0) {
    return players.map((player) => sanitizePlayer(player.id, player));
  }
  const prevMap = new Map(previous.map((player) => [player.id, player]));
  let mutated = previous.length !== players.length;
  const next = players.map((player) => {
    const sanitized = sanitizePlayer(player.id, player);
    const prev = prevMap.get(sanitized.id);
    if (prev && playerDocsEqual(prev, sanitized)) {
      return prev;
    }
    mutated = true;
    return sanitized;
  });
  return mutated ? next : previous;
}

export function recordRoomMetrics(
  room: (RoomDoc & { id?: string }) | null,
  players: SanitizedPlayer[],
  onlineUids?: string[],
  presenceReady?: boolean
): void {
  if (typeof window === "undefined") return;
  try {
    setMetric("room", "status", room?.status ?? "unknown");
    setMetric("room", "players", players.length);
    setMetric("room", "online", Array.isArray(onlineUids) ? onlineUids.length : 0);
    setMetric("room", "presenceReady", presenceReady ? 1 : 0);
  } catch {
    // metrics are best-effort and should never break the machine
  }
}

export function sanitizeOrderList(values: string[] | undefined | null): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
}

export function resolveStatus(room: (RoomDoc & { id?: string }) | null): RoomDoc["status"] {
  return room?.status ?? "waiting";
}

