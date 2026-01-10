export type PresenceConnection = {
  ts?: number;
  online?: boolean;
};
export type PresenceConnections = Record<string, PresenceConnection>;
export type PresenceRoomSnapshot = Record<string, PresenceConnections>;

export type DerivePresenceCountResult = {
  count: number;
  hasFresh: boolean;
  includedUids?: string[];
  presentUids?: string[];
  roomQuarantine: Record<string, number>;
};

export function derivePresenceCount(params: {
  users: PresenceRoomSnapshot;
  excludeUidSet: ReadonlySet<string>;
  now: number;
  maxClockSkewMs: number;
  staleMs: number;
  acceptFreshMs: number;
  debugUids: boolean;
  roomQuarantine?: Record<string, number> | undefined;
}): DerivePresenceCountResult {
  const roomQuarantine: Record<string, number> = { ...(params.roomQuarantine || {}) };

  let n = 0;
  let hasFresh = false;

  const includedUids: string[] | undefined = params.debugUids ? [] : undefined;
  const presentUids: string[] | undefined = params.debugUids ? Object.keys(params.users) : undefined;

  for (const uid of Object.keys(params.users)) {
    if (params.excludeUidSet.has(uid)) continue;
    const conns: PresenceConnections = params.users[uid] || {};

    let latestValidTs = 0;
    for (const conn of Object.values<PresenceConnection>(conns)) {
      if (conn?.online === false) continue;
      if (conn?.online === true && typeof conn?.ts !== "number") {
        latestValidTs = Math.max(latestValidTs, params.now);
        hasFresh = true;
        continue;
      }
      const ts = typeof conn?.ts === "number" ? conn.ts : 0;
      if (ts <= 0) continue;
      if (ts - params.now > params.maxClockSkewMs) continue;
      if (params.now - ts > params.staleMs) continue;
      latestValidTs = Math.max(latestValidTs, ts);
      if (!hasFresh && params.now - ts <= params.acceptFreshMs) hasFresh = true;
    }

    const qUntil = roomQuarantine[uid] || 0;
    if (qUntil && latestValidTs > 0) {
      const isFresh = params.now - latestValidTs <= params.acceptFreshMs;
      if (isFresh) {
        delete roomQuarantine[uid];
      } else {
        continue;
      }
    }

    const isOnline = latestValidTs > 0;
    if (isOnline) {
      n += 1;
      if (includedUids) includedUids.push(uid);
    }
  }

  return {
    count: n,
    hasFresh,
    includedUids,
    presentUids,
    roomQuarantine,
  };
}

