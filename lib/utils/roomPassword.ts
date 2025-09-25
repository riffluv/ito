export const ROOM_PASSWORD_SESSION_PREFIX = "room-pass:";

export function getRoomPasswordSessionKey(roomId: string): string {
  return `${ROOM_PASSWORD_SESSION_PREFIX}${roomId}`;
}

export function storeRoomPasswordHash(roomId: string, hash: string | null | undefined) {
  if (typeof window === "undefined" || !hash) return;
  try {
    window.sessionStorage.setItem(getRoomPasswordSessionKey(roomId), hash);
  } catch {
    // ignore
  }
}

export function getCachedRoomPasswordHash(roomId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(getRoomPasswordSessionKey(roomId));
  } catch {
    return null;
  }
}

export function clearRoomPasswordHash(roomId: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(getRoomPasswordSessionKey(roomId));
  } catch {
    // ignore
  }
}
