const leavingUsers = new Set<string>();

export function acquireLeaveLock(roomId: string, userId: string): boolean {
  const key = `${roomId}:${userId}`;
  if (leavingUsers.has(key)) {
    return false;
  }
  leavingUsers.add(key);
  return true;
}

export function releaseLeaveLock(roomId: string, userId: string): void {
  leavingUsers.delete(`${roomId}:${userId}`);
}
