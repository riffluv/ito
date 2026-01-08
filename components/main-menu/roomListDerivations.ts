import { stripMinimalTag } from "@/lib/game/displayMode";
import { toMillis } from "@/lib/time";
import type { RoomDoc } from "@/lib/types";
import type { LobbyRoom } from "@/components/main-menu/types";

export function filterLobbyRooms(params: {
  rooms: LobbyRoom[];
  lobbyCounts: Record<string, number | undefined>;
  nowMs: number;
  recentWindowMs: number;
  inProgressDisplayMs?: number;
  createdWindowMs?: number;
}): LobbyRoom[] {
  const {
    rooms,
    lobbyCounts,
    nowMs,
    recentWindowMs,
    inProgressDisplayMs = 15 * 60 * 1000,
    createdWindowMs = 10 * 60 * 1000,
  } = params;

  return rooms.filter((room) => {
    const expiresAtMs = toMillis(room.expiresAt);
    if (expiresAtMs && expiresAtMs <= nowMs) {
      return false;
    }

    const status = room.status as RoomDoc["status"] | "completed";
    if (status === "finished" || status === "completed") {
      return false;
    }

    const activeCount = lobbyCounts[room.id] ?? 0;
    const lastActiveMs = toMillis(room.lastActiveAt);
    const createdMs = toMillis(room.createdAt);
    const newestMs = Math.max(lastActiveMs, createdMs);

    const inProgress = status !== "waiting";
    if (inProgress) {
      if (activeCount > 0) {
        return true;
      }
      return newestMs > 0 && nowMs - newestMs <= inProgressDisplayMs;
    }

    if (activeCount > 0) {
      return true;
    }

    if (newestMs > 0 && nowMs - newestMs <= recentWindowMs) {
      return true;
    }

    if (createdMs > 0 && nowMs - createdMs <= createdWindowMs) {
      return true;
    }

    return false;
  });
}

export function filterLobbyRoomsByOptions(params: {
  rooms: LobbyRoom[];
  hideLockedRooms: boolean;
  showJoinableOnly: boolean;
}): LobbyRoom[] {
  const { rooms, hideLockedRooms, showJoinableOnly } = params;
  return rooms.filter((room) => {
    if (hideLockedRooms && room.requiresPassword) {
      return false;
    }
    if (showJoinableOnly && room.status !== "waiting") {
      return false;
    }
    return true;
  });
}

export function filterLobbyRoomsBySearch(params: {
  rooms: LobbyRoom[];
  debouncedSearch: string;
}): LobbyRoom[] {
  const { rooms, debouncedSearch } = params;
  if (!debouncedSearch) return rooms;

  const query = debouncedSearch.toLowerCase();
  return rooms.filter((room) => {
    const baseName = stripMinimalTag(room.name)?.toString().toLowerCase() ?? "";
    const hostName = room.hostName?.toLowerCase?.() ?? "";
    const creatorName = room.creatorName?.toLowerCase?.() ?? "";
    return (
      baseName.includes(query) ||
      hostName.includes(query) ||
      creatorName.includes(query)
    );
  });
}

export function sortLobbyRooms(params: {
  rooms: LobbyRoom[];
  lobbyCounts: Record<string, number | undefined>;
}): LobbyRoom[] {
  const { rooms, lobbyCounts } = params;
  const list = [...rooms];
  list.sort((a, b) => {
    const countA = lobbyCounts[a.id] ?? 0;
    const countB = lobbyCounts[b.id] ?? 0;
    if ((countB > 0 ? 1 : 0) !== (countA > 0 ? 1 : 0)) {
      return (countB > 0 ? 1 : 0) - (countA > 0 ? 1 : 0);
    }
    const createdA = toMillis(a.createdAt);
    const createdB = toMillis(b.createdAt);
    if (createdA !== createdB) {
      return createdB - createdA;
    }
    return toMillis(b.lastActiveAt) - toMillis(a.lastActiveAt);
  });
  return list;
}

