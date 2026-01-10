import type { TopicType } from "@/lib/topics";

export type TopicSections = {
  normal: string[];
  rainbow: string[];
  classic: string[];
};

export type TopicAction =
  | { kind: "select"; type: TopicType }
  | { kind: "shuffle"; type: TopicType | null }
  | { kind: "custom"; text: string }
  | { kind: "reset" };

export function selectTopicPool(sections: TopicSections, topicType: TopicType | null): string[] {
  if (!topicType) return [];
  if (topicType === "通常版") return sections.normal;
  if (topicType === "レインボー版") return sections.rainbow;
  return sections.classic;
}

export function deriveTopicTypeFromAction(action: TopicAction): TopicType | null {
  if (action.kind === "select") return action.type;
  if (action.kind === "shuffle") return action.type ?? null;
  return null;
}

export function validateTopicTypeForAction(params: {
  action: TopicAction;
  topicType: TopicType | null;
}): "ok" | "invalid_topic_type" | "missing_topic_type" {
  if (params.action.kind === "select" && !params.topicType) return "invalid_topic_type";
  if (params.action.kind === "shuffle" && !params.topicType) return "missing_topic_type";
  return "ok";
}

export function buildTopicResetRoomUpdates(params: {
  serverNow: unknown;
}): Record<string, unknown> {
  return {
    status: "waiting",
    result: null,
    deal: null,
    order: null,
    round: 0,
    topic: null,
    topicOptions: null,
    topicBox: null,
    closedAt: null,
    expiresAt: null,
    lastActiveAt: params.serverNow,
  };
}

export function buildTopicCustomRoomUpdates(params: { topic: string; serverNow: unknown }): Record<string, unknown> {
  return {
    topic: params.topic,
    topicBox: "カスタム",
    topicOptions: null,
    lastActiveAt: params.serverNow,
  };
}

export function buildTopicSelectOrShuffleRoomUpdates(params: {
  topicBox: TopicType | null;
  topic: string | null;
  serverNow: unknown;
}): Record<string, unknown> {
  return {
    topicBox: params.topicBox ?? null,
    topicOptions: null,
    topic: params.topic,
    lastActiveAt: params.serverNow,
  };
}
