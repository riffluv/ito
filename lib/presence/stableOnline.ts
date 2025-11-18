import { PRESENCE_DISAPPEAR_GRACE_MS } from "@/lib/constants/uiTimings";

export type MissingSinceStore = Record<string, number>;

type DeriveParams = {
  onlineUids: string[];
  previousStable?: string[] | undefined;
  missingSince?: MissingSinceStore;
  now: number;
  graceMs?: number;
};

/**
 * Presence の transient drop を吸収し、一定時間は安定したオンライン集合を維持する。
 * 副作用なし・渡されたストアを破壊しない純粋関数。
 */
export function deriveStableOnlineUids({
  onlineUids,
  previousStable,
  missingSince,
  now,
  graceMs = PRESENCE_DISAPPEAR_GRACE_MS,
}: DeriveParams): {
  stable: string[];
  missingSince: MissingSinceStore;
} {
  const nextMissing: MissingSinceStore = { ...(missingSince || {}) };

  // まず現在オンラインのUIDを結果に入れ、missingキャッシュからは除外
  const stableSet = new Set<string>();
  for (const uid of onlineUids) {
    stableSet.add(uid);
    if (uid in nextMissing) {
      delete nextMissing[uid];
    }
  }

  const previousSet = new Set(previousStable ?? onlineUids);
  for (const uid of previousSet) {
    if (stableSet.has(uid)) continue;
    const firstMissingAt =
      typeof nextMissing[uid] === "number" ? nextMissing[uid] : now;
    nextMissing[uid] = firstMissingAt;
    if (now - firstMissingAt < graceMs) {
      stableSet.add(uid);
    }
  }

  return {
    stable: Array.from(stableSet),
    missingSince: nextMissing,
  };
}
