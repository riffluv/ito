"use client";

import { startGame, topicControls } from "@/lib/game/service";
import { topicTypeLabels, type TopicType } from "@/lib/topics";
import type { RoomDoc } from "@/lib/types";

const FALLBACK_TOPIC: TopicType = "通常版";

export type ExecuteQuickStartOptions = {
  roomStatus?: RoomDoc["status"] | null;
  defaultTopicType?: string | null;
  ensureStart?: boolean;
};

function normalizeTopicType(type: string | null | undefined): TopicType {
  if (!type || type === "カスタム") {
    return FALLBACK_TOPIC;
  }
  if ((topicTypeLabels as readonly string[]).includes(type)) {
    return type as TopicType;
  }
  return FALLBACK_TOPIC;
}

export async function executeQuickStart(
  roomId: string,
  options: ExecuteQuickStartOptions = {}
): Promise<void> {
  const { roomStatus, defaultTopicType, ensureStart = true } = options;
  const topicType = normalizeTopicType(defaultTopicType);

  if (ensureStart && roomStatus === "waiting") {
    await startGame(roomId);
  } else if (ensureStart && !roomStatus) {
    await startGame(roomId);
  }

  await Promise.all([
    topicControls.selectCategory(roomId, topicType),
    topicControls.dealNumbers(roomId),
  ]);
}
