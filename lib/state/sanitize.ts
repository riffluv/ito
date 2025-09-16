import { normalizeResolveMode } from "@/lib/game/resolveMode";
import { getDisplayMode, hasMinimalTag } from "@/lib/game/displayMode";
import type { PlayerDoc, RoomDoc } from "@/lib/types";

export function sanitizeRoom(input: any): RoomDoc {
  const status = ((): RoomDoc["status"] => {
    const s = input?.status;
    return s === "waiting" || s === "clue" || s === "reveal" || s === "finished"
      ? s
      : "waiting";
  })();
  const options = input?.options || { allowContinueAfterFail: true };
  const validTopic = (t: any) =>
    t === "通常版" || t === "レインボー版" || t === "クラシック版" || t === "カスタム";
  return {
    name: String(input?.name || "Untitled"),
    hostId: String(input?.hostId || ""),
    // ルームDocに埋め込んだホスト名を通す（未設定時はundefinedのまま）
    hostName:
      typeof input?.hostName === "string" && input.hostName.trim()
        ? String(input.hostName)
        : undefined,
    options: {
      allowContinueAfterFail: !!options.allowContinueAfterFail,
      resolveMode: normalizeResolveMode(options.resolveMode),
      // displayMode は保存されていれば通し、なければ name のサフィックスから派生
      displayMode:
        options?.displayMode === "minimal" || options?.displayMode === "full"
          ? options.displayMode
          : hasMinimalTag(input?.name)
            ? "minimal"
            : undefined,
      defaultTopicType: validTopic(options?.defaultTopicType)
        ? options.defaultTopicType
        : undefined,
    },
    status,
    createdAt: input?.createdAt,
    lastActiveAt: input?.lastActiveAt,
    closedAt: input?.closedAt ?? null,
    expiresAt: input?.expiresAt ?? null,
    topic: input?.topic ?? null,
    topicOptions: Array.isArray(input?.topicOptions)
      ? input.topicOptions.map((x: any) => String(x))
      : null,
    topicBox: input?.topicBox ?? null,
    order: input?.order ?? null,
    result: input?.result ?? null,
    deal: input?.deal ?? null,
    round: typeof input?.round === "number" ? input.round : 0,
  };
}

export function sanitizePlayer(
  id: string,
  input: any
): PlayerDoc & { id: string } {
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
  };
}
