import type { PlayerDoc, RoomDoc } from "@/lib/types";

export function sanitizeRoom(input: any): RoomDoc {
  const status = ((): RoomDoc["status"] => {
    const s = input?.status;
    return s === "waiting" || s === "clue" || s === "playing" || s === "reveal" || s === "finished"
      ? s
      : "waiting";
  })();
  const options = input?.options || { allowContinueAfterFail: true };
  return {
    name: String(input?.name || "Untitled"),
    hostId: String(input?.hostId || ""),
    options: {
      allowContinueAfterFail: !!options.allowContinueAfterFail,
      resolveMode:
        options.resolveMode === "sort-submit" || options.resolveMode === "sequential"
          ? options.resolveMode
          : "sequential",
    },
    status,
    createdAt: input?.createdAt,
    lastActiveAt: input?.lastActiveAt,
    closedAt: input?.closedAt ?? null,
    expiresAt: input?.expiresAt ?? null,
    topic: input?.topic ?? null,
    topicOptions: Array.isArray(input?.topicOptions) ? input.topicOptions.map((x: any) => String(x)) : null,
    topicBox: input?.topicBox ?? null,
    order: input?.order ?? null,
    result: input?.result ?? null,
    deal: input?.deal ?? null,
    round: typeof input?.round === "number" ? input.round : 0,
  };
}

export function sanitizePlayer(id: string, input: any): PlayerDoc & { id: string } {
  return {
    id,
    name: String(input?.name || "匿名"),
    avatar: String(input?.avatar || ""),
    number: typeof input?.number === "number" ? input.number : null,
    clue1: typeof input?.clue1 === "string" ? input.clue1 : "",
    ready: !!input?.ready,
    orderIndex: typeof input?.orderIndex === "number" ? input.orderIndex : 0,
    uid: input?.uid || undefined,
    lastSeen: input?.lastSeen,
  } as any;
}
