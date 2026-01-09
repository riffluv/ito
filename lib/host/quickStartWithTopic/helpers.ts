type OnlineUids = (string | null | undefined)[] | null | undefined;

export function buildQuickStartValidStatuses(params: {
  allowFromFinished: boolean;
  allowFromClue: boolean;
}): string[] {
  const validStatuses: string[] = ["waiting"];
  if (params.allowFromFinished) {
    validStatuses.push("reveal", "finished");
  }
  if (params.allowFromClue) {
    validStatuses.push("clue");
  }
  return validStatuses;
}

export function filterPresenceUids(onlineUids: OnlineUids): string[] | undefined {
  if (!Array.isArray(onlineUids) || onlineUids.length === 0) return undefined;
  const filtered = onlineUids.filter(
    (id): id is string => typeof id === "string" && id.trim().length > 0
  );
  return filtered.length > 0 ? filtered : undefined;
}

export function needsCustomTopic(params: {
  topicType: string;
  customTopic?: string | null;
  topic?: string | null;
}): boolean {
  if (params.topicType !== "カスタム") return false;
  const custom = typeof params.customTopic === "string" ? params.customTopic.trim() : "";
  const existing = typeof params.topic === "string" ? params.topic.trim() : "";
  return custom.length === 0 && existing.length === 0;
}

export function isHostMismatch(params: {
  roomHostId: string | null;
  authUid: string | null;
}): boolean {
  const { roomHostId, authUid } = params;
  if (!roomHostId) return false;
  if (!authUid) return false;
  return roomHostId !== authUid;
}

