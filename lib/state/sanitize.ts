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
    creatorId: String(input?.creatorId || ""),
    creatorName:
      typeof input?.creatorName === "string" && input.creatorName.trim()
        ? String(input.creatorName)
        : undefined,
    requiresPassword: !!input?.requiresPassword,
    passwordHash: typeof input?.passwordHash === "string" ? input.passwordHash : null,
    passwordSalt: typeof input?.passwordSalt === "string" ? input.passwordSalt : null,
    passwordVersion: typeof input?.passwordVersion === "number" ? input.passwordVersion : null,

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
    mvpVotes: (() => {
      if (!input?.mvpVotes || typeof input.mvpVotes !== "object") {
        return null;
      }
      const entries = Object.entries(input.mvpVotes).filter(
        ([voterId, votedId]) => typeof voterId === "string" && typeof votedId === "string" && votedId
      );
      if (entries.length === 0) {
        return {};
      }
      return entries.reduce<Record<string, string>>((acc, [voterId, votedId]) => {
        acc[String(voterId)] = String(votedId);
        return acc;
      }, {});
    })(),
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
    joinedAt: input?.joinedAt,
  };
}
