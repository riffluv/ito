import { normalizeResolveMode } from "@/lib/game/resolveMode";
import { hasMinimalTag } from "@/lib/game/displayMode";
import { normalizeRoomStats } from "@/lib/game/roomStats";
import type { PlayerDoc, RoomDoc } from "@/lib/types";

type UnknownRoom = Partial<RoomDoc> & Record<string, unknown>;
type UnknownPlayer = Partial<PlayerDoc> & Record<string, unknown>;

export function sanitizeRoom(input: unknown): RoomDoc {
  const roomInput: UnknownRoom = (input ?? {}) as UnknownRoom;
  const status = ((): RoomDoc["status"] => {
    const s = roomInput?.status;
    return s === "waiting" || s === "clue" || s === "reveal" || s === "finished"
      ? s
      : "waiting";
  })();
  const rawOptions = (roomInput?.options ?? {}) as Partial<RoomDoc["options"]>;
  const allowContinueAfterFail =
    typeof rawOptions?.allowContinueAfterFail === "boolean"
      ? rawOptions.allowContinueAfterFail
      : true;
  const validTopic = (t: unknown) =>
    t === "通常版" || t === "レインボー版" || t === "クラシック版" || t === "カスタム";
  return {
    name: String(roomInput?.name || "Untitled"),
    hostId: String(roomInput?.hostId || ""),
    // ルームDocに埋め込んだホスト名を通す（未設定時はundefinedのまま）
    hostName:
      typeof roomInput?.hostName === "string" && roomInput.hostName.trim()
        ? String(roomInput.hostName)
        : undefined,
    creatorId: String(roomInput?.creatorId || ""),
    creatorName:
      typeof roomInput?.creatorName === "string" && roomInput.creatorName.trim()
        ? String(roomInput.creatorName)
        : undefined,
    appVersion:
      typeof roomInput?.appVersion === "string" && roomInput.appVersion.trim().length > 0
        ? roomInput.appVersion.trim()
        : undefined,
    requiresPassword: !!roomInput?.requiresPassword,
    passwordHash: typeof roomInput?.passwordHash === "string" ? roomInput.passwordHash : null,
    passwordSalt: typeof roomInput?.passwordSalt === "string" ? roomInput.passwordSalt : null,
    passwordVersion: typeof roomInput?.passwordVersion === "number" ? roomInput.passwordVersion : null,

    options: {
      allowContinueAfterFail,
      resolveMode: normalizeResolveMode(rawOptions?.resolveMode),
      // displayMode は保存されていれば通し、なければ name のサフィックスから派生
      displayMode:
        rawOptions?.displayMode === "minimal" || rawOptions?.displayMode === "full"
          ? rawOptions.displayMode
          : hasMinimalTag(roomInput?.name)
            ? "minimal"
            : undefined,
      defaultTopicType: validTopic(rawOptions?.defaultTopicType)
        ? rawOptions.defaultTopicType
        : undefined,
    },
    status,
    createdAt: roomInput?.createdAt,
    lastActiveAt: roomInput?.lastActiveAt,
    closedAt: roomInput?.closedAt ?? null,
    expiresAt: roomInput?.expiresAt ?? null,
    topic: roomInput?.topic ?? null,
    topicOptions: Array.isArray(roomInput?.topicOptions)
      ? roomInput.topicOptions.map((x) => String(x))
      : null,
    topicBox: roomInput?.topicBox ?? null,
    order: roomInput?.order ?? null,
    result: roomInput?.result ?? null,
    stats: normalizeRoomStats(roomInput?.stats),
    deal: roomInput?.deal ?? null,
    round: typeof roomInput?.round === "number" ? roomInput.round : 0,
    mvpVotes: (() => {
      if (!roomInput?.mvpVotes || typeof roomInput.mvpVotes !== "object") {
        return null;
      }
      const entries = Object.entries(roomInput.mvpVotes).filter(
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
    // バージョン同期用フィールド（存在しなくても良い）
    updatePhase: (() => {
      const p = roomInput?.updatePhase;
      return p === 'required' || p === 'done' ? p : undefined;
    })(),
    requiredSwVersion: (() => {
      const v = roomInput?.requiredSwVersion;
      return typeof v === 'string' && v ? v : undefined;
    })(),
    // 冪等化用フィールド（存在しなくても良い）
    startRequestId:
      typeof roomInput?.startRequestId === "string"
        ? roomInput.startRequestId
        : roomInput?.startRequestId === null
          ? null
          : undefined,
    resetRequestId:
      typeof roomInput?.resetRequestId === "string"
        ? roomInput.resetRequestId
        : roomInput?.resetRequestId === null
          ? null
          : undefined,
    ...((): Partial<Pick<RoomDoc, "ui">> => {
      const raw = roomInput?.ui;
      if (!raw || typeof raw !== "object") {
        return {};
      }
      const typed = raw as Record<string, unknown> & NonNullable<RoomDoc["ui"]>;
      const next: NonNullable<RoomDoc["ui"]> = {};
      if (typed.recallOpen === true) {
        next.recallOpen = true;
      } else if (typed.recallOpen === false) {
        next.recallOpen = false;
      }
      if (typed.revealPending === true) {
        next.revealPending = true;
      } else if (typed.revealPending === false) {
        next.revealPending = false;
      }
      if (typed.roundPreparing === true) {
        next.roundPreparing = true;
      } else if (typed.roundPreparing === false) {
        next.roundPreparing = false;
      }
      if ("revealBeginAt" in typed) {
        const value = typed.revealBeginAt;
        if (value && typeof value === "object") {
          next.revealBeginAt = value;
        } else if (value === null) {
          next.revealBeginAt = null;
        }
      }
      return Object.keys(next).length > 0 ? { ui: next } : {};
    })(),
  };
}

export function sanitizePlayer(
  id: string,
  input: unknown
): PlayerDoc & { id: string } {
  const playerInput: UnknownPlayer = (input ?? {}) as UnknownPlayer;
  return {
    id,
    name: String(playerInput?.name || "匿名"),
    avatar: String(playerInput?.avatar || ""),
    number: typeof playerInput?.number === "number" ? playerInput.number : null,
    clue1: typeof playerInput?.clue1 === "string" ? playerInput.clue1 : "",
    ready: !!playerInput?.ready,
    orderIndex: typeof playerInput?.orderIndex === "number" ? playerInput.orderIndex : 0,
    uid: playerInput?.uid || undefined,
    lastSeen: playerInput?.lastSeen,
    joinedAt: playerInput?.joinedAt,
  };
}
