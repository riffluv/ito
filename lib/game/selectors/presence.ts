type PresenceArgs = {
  baseIds: readonly string[];
  onlineUids?: readonly string[] | null;
  presenceReady: boolean;
  /**
   * presence が未準備かつ onlineUids が空のときに eligibleIds を空にしてブロックするか。
   * 既定 true（START/DEAL ガード目的）。
   * UI 表示などでフォールバックしたい場合は false を渡す。
   */
  blockWhenNotReadyEmpty?: boolean;
};

export function getPresenceEligibleIds({
  baseIds,
  onlineUids,
  presenceReady,
  blockWhenNotReadyEmpty = true,
}: PresenceArgs): string[] {
  // presenceReady が立っておらず、オンライン情報も空なら開始をブロック
  if (
    blockWhenNotReadyEmpty &&
    !presenceReady &&
    (!Array.isArray(onlineUids) || onlineUids.length === 0)
  ) {
    return [];
  }
  if (!presenceReady) {
    return [...baseIds];
  }
  if (!Array.isArray(onlineUids) || onlineUids.length === 0) {
    return [...baseIds];
  }

  const onlineSet = new Set(onlineUids);
  const filtered = baseIds.filter((id) => onlineSet.has(id));

  if (filtered.length === 0) {
    return [...baseIds];
  }

  if (filtered.length === baseIds.length) {
    return filtered;
  }

  const missing = baseIds.filter((id) => !onlineSet.has(id));
  return [...filtered, ...missing];
}

export function prioritizeHostId(opts: {
  eligibleIds: string[];
  hostId?: string | null;
}): string[] {
  const hostId = typeof opts.hostId === "string" ? opts.hostId : "";
  const eligibleIds = opts.eligibleIds;
  if (!hostId) return eligibleIds;
  if (eligibleIds.length === 0) return eligibleIds;
  if (eligibleIds[0] === hostId) return eligibleIds;
  if (!eligibleIds.includes(hostId)) return eligibleIds;
  return [hostId, ...eligibleIds.filter((id) => id !== hostId)];
}
