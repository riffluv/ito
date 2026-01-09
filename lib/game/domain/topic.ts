import type { RoomDoc } from "@/lib/types";

export const hasValidTopic = (room: RoomDoc): boolean =>
  typeof room.topic === "string" && room.topic.length > 0;

