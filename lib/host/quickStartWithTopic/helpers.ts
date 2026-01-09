export { filterPresenceUids } from "@/lib/host/hostActionsControllerHelpers";

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
