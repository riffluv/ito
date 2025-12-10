import { APP_VERSION } from "@/lib/constants/appVersion";
import type { RoomDoc } from "@/lib/types";
import { logWarn } from "@/lib/utils/log";
import { traceAction } from "@/lib/utils/trace";
import { apiJoinRoom, apiReady, apiUpdateRoomOptions } from "@/lib/services/roomApiClient";

const AVATAR_CACHE_TTL_MS = 30_000;
type AvatarCacheEntry = {
  used: Set<string>;
  expiresAt: number;
};

const avatarCache = new Map<string, AvatarCacheEntry>();
const versionGateCache = new Map<
  string,
  | { status: "ok"; appVersion: string | null; checkedAt: number }
  | { status: "mismatch"; roomVersion: string | null; checkedAt: number }
>();
const VERSION_CHECK_TTL_MS = 60_000;

type VersionAllowedResult =
  | { status: "ok"; appVersion: string | null }
  | { status: "mismatch"; roomVersion: string | null }
  | { status: "check_failed"; detail: string };

async function ensureRoomVersionAllowed(
  roomId: string,
  clientVersion: string
): Promise<VersionAllowedResult>
{
  const now = Date.now();
  const cached = versionGateCache.get(roomId);
  if (cached && now - cached.checkedAt < VERSION_CHECK_TTL_MS) {
    return cached.status === "ok"
      ? { status: "ok", appVersion: cached.appVersion }
      : { status: "mismatch", roomVersion: cached.roomVersion };
  }

  try {
    const response = await fetch("/api/rooms/version-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, clientVersion }),
      keepalive: true,
    });

    if (response.ok) {
      const data = (await response.json()) as { appVersion?: string | null };
      const appVersion = typeof data?.appVersion === "string" ? data.appVersion : null;
      versionGateCache.set(roomId, { status: "ok", appVersion, checkedAt: now });
      return { status: "ok", appVersion };
    }

    let errorBody: { error?: unknown; roomVersion?: unknown } | null = null;
    try {
      errorBody = (await response.json()) as { error?: unknown; roomVersion?: unknown };
    } catch {
      // ignore body parse errors
    }

    if (errorBody?.error === "room/join/version-mismatch") {
      const roomVersion =
        typeof errorBody.roomVersion === "string" && errorBody.roomVersion.trim().length > 0
          ? errorBody.roomVersion.trim()
          : null;
      versionGateCache.set(roomId, {
        status: "mismatch",
        roomVersion,
        checkedAt: now,
      });
      return { status: "mismatch", roomVersion };
    }

    // サーバーからのエラー応答（バージョン不一致以外）
    logWarn("roomService", "version-check-server-error", { roomId, status: response.status, errorBody });
    return { status: "check_failed", detail: `server_error_${response.status}` };
  } catch (error) {
    logWarn("roomService", "version-check-failed", { roomId, error });
    // フェイルクローズ：API 取得に失敗した場合は安全のため入室を拒否
    return { status: "check_failed", detail: "network_error" };
  }
}

function getAvatarCache(roomId: string): AvatarCacheEntry | null {
  const entry = avatarCache.get(roomId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    avatarCache.delete(roomId);
    return null;
  }
  return entry;
}

function setAvatarCache(roomId: string, avatars: Iterable<string>) {
  avatarCache.set(roomId, {
    used: new Set(avatars),
    expiresAt: Date.now() + AVATAR_CACHE_TTL_MS,
  });
}

function registerAvatarUsage(roomId: string, avatar: string) {
  const entry = getAvatarCache(roomId);
  if (!entry) {
    setAvatarCache(roomId, [avatar]);
    return;
  }
  entry.used.add(avatar);
  entry.expiresAt = Date.now() + AVATAR_CACHE_TTL_MS;
}

export type RoomServiceErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_IN_PROGRESS"
  | "ROOM_VERSION_MISMATCH"
  | "ROOM_VERSION_CHECK_FAILED";

const ROOM_ERROR_MESSAGES: Record<RoomServiceErrorCode, string> = {
  ROOM_NOT_FOUND: "部屋が見つかりませんでした。",
  ROOM_IN_PROGRESS: "ゲーム進行中のため席に戻れません。",
  ROOM_VERSION_MISMATCH: "この部屋とは別のバージョンで動作しています。",
  ROOM_VERSION_CHECK_FAILED: "バージョン確認に失敗しました。ページを更新してからやり直してください。",
};

export class RoomServiceError extends Error {
  readonly code: RoomServiceErrorCode;
  readonly roomVersion?: string | null;
  readonly clientVersion?: string | null;

  constructor(code: RoomServiceErrorCode, detail?: { roomVersion?: string | null; clientVersion?: string | null }) {
    super(ROOM_ERROR_MESSAGES[code]);
    this.name = "RoomServiceError";
    this.code = code;
    this.roomVersion = detail?.roomVersion ?? null;
    this.clientVersion = detail?.clientVersion ?? null;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const ROOM_ERROR_CODES: RoomServiceErrorCode[] = [
  "ROOM_NOT_FOUND",
  "ROOM_IN_PROGRESS",
  "ROOM_VERSION_MISMATCH",
  "ROOM_VERSION_CHECK_FAILED",
];

const isRoomServiceErrorCode = (
  value: unknown
): value is RoomServiceErrorCode =>
  typeof value === "string" &&
  ROOM_ERROR_CODES.includes(value as RoomServiceErrorCode);

export const getRoomServiceErrorCode = (
  error: unknown
): RoomServiceErrorCode | null => {
  if (error instanceof RoomServiceError) {
    return error.code;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    const codeValue = (error as { code?: unknown }).code;
    if (isRoomServiceErrorCode(codeValue)) {
      return codeValue;
    }
  }
  return null;
};

type EnsureMemberResult =
  | { joined: true }
  | { joined: false }
  | { joined: false; reason: "inProgress" };

type EnsureMemberArgs = {
  roomId: string;
  uid: string;
  displayName: string | null | undefined;
  clientVersion?: string;
};

/**
 * displayName が未解決の場合でも、過去に保存した値を優先して使用する
 * （匿名で一度生成されるのを防ぎ、avatar の再割り当てを抑止する）。
 */
const resolvePreferredDisplayName = (
  displayName: string | null | undefined
): { value: string; source: "prop" | "localStorage" | "fallback" } => {
  const trimmed =
    typeof displayName === "string" ? displayName.trim() : "";
  if (trimmed.length > 0) return { value: trimmed, source: "prop" };

  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem("displayName") ?? "";
      const cachedTrimmed = cached.trim();
      if (cachedTrimmed.length > 0) {
        return { value: cachedTrimmed, source: "localStorage" };
      }
    } catch {
      /* ignore localStorage access failures */
    }
  }

  return { value: "匿名", source: "fallback" };
};

const AVATAR_STORAGE_KEY = "__stickyAvatars__"; // JSON { [roomId]: { [uid]: avatarPath } }

const writeStoredAvatar = (roomId: string, uid: string, avatar: string) => {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(AVATAR_STORAGE_KEY);
    const parsed =
      (raw ? (JSON.parse(raw) as Record<string, Record<string, string>>) : {}) ??
      {};
    const roomMap = parsed[roomId] ?? {};
    roomMap[uid] = avatar;
    parsed[roomId] = roomMap;
    window.localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
};

export async function ensureMember({
  roomId,
  uid,
  displayName,
  clientVersion,
}: EnsureMemberArgs): Promise<EnsureMemberResult> {
  const versionToSend = clientVersion ?? APP_VERSION;

  const versionGate = await ensureRoomVersionAllowed(roomId, versionToSend);
  if (versionGate.status === "mismatch") {
    throw new RoomServiceError("ROOM_VERSION_MISMATCH", {
      roomVersion: versionGate.roomVersion,
      clientVersion: versionToSend,
    });
  }
  if (versionGate.status === "check_failed") {
    // フェイルクローズ: バージョン確認ができないため安全のため入室を拒否
    throw new RoomServiceError("ROOM_VERSION_CHECK_FAILED");
  }

  const { value: resolvedDisplayName } = resolvePreferredDisplayName(displayName);

  try {
    const result = await apiJoinRoom({ roomId, displayName: resolvedDisplayName });
    if (result?.avatar) {
      registerAvatarUsage(roomId, result.avatar);
      writeStoredAvatar(roomId, uid, result.avatar);
    }
    return result?.joined ? { joined: true } : { joined: false };
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    if (code === "room_not_found") {
      throw new RoomServiceError("ROOM_NOT_FOUND");
    }
    if (code === "room_in_progress" || code === "room_recall_closed") {
      traceAction("join.blocked", { roomId, uid, code });
      return { joined: false, reason: "inProgress" } as const;
    }
    if (code === "room/join/version-mismatch") {
      throw new RoomServiceError("ROOM_VERSION_MISMATCH", {
        roomVersion: (error as { details?: { roomVersion?: string | null } })?.details?.roomVersion ?? null,
        clientVersion: versionToSend,
      });
    }
    throw error;
  }
}

// Reset player's ready flag when round changes (UI layer should call this instead of direct updateDoc)
export async function resetPlayerReadyOnRoundChange(
  roomId: string,
  uid: string,
  nextRound: number
): Promise<void> {
  try {
    traceAction("player.ready.reset", { roomId, uid, nextRound });
    await apiReady(roomId, false);
  } catch (error) {
    traceAction("player.ready.reset.error", { roomId, uid, nextRound });
    throw error;
  }
}

export async function updateRoomOptions(
  roomId: string,
  options: {
    resolveMode?: string;
    defaultTopicType?: string;
  }
): Promise<void> {
  await apiUpdateRoomOptions({
    roomId,
    resolveMode: options.resolveMode,
    defaultTopicType: options.defaultTopicType,
  });
}

export async function assignNumberIfNeeded(
  roomId: string,
  uid: string,
  roomFromState?: Partial<RoomDoc> | null
) {
  const room = roomFromState || null;
  const numbers = room?.order?.numbers ?? null;
  const hasAssignedNumber =
    numbers && typeof numbers[uid as keyof typeof numbers] === "number";
  if (hasAssignedNumber) return;
  // サーバー側で配布するためクライアントは何もしない（互換用の空実装）
}
export async function joinRoomFully({
  roomId,
  uid,
  displayName,
  notifyChat = true,
}: {
  roomId: string;
  uid: string;
  displayName: string | null | undefined;
  notifyChat?: boolean;
}): Promise<EnsureMemberResult> {
  const { value: resolvedDisplayName } =
    resolvePreferredDisplayName(displayName);
  const created = await ensureMember({
    roomId,
    uid,
    displayName: resolvedDisplayName,
    clientVersion: APP_VERSION,
  });
  const inProgress =
    "reason" in created && created.reason === "inProgress";
  if (inProgress) {
    logWarn("roomService", "joinRoomFully-blocked-in-progress", {
      roomId,
      uid,
    });
    throw new RoomServiceError("ROOM_IN_PROGRESS");
  }
  const { logInfo } = await import("@/lib/utils/log");
  logInfo("room-service", "joinRoomFully-complete", {
    roomId,
    uid,
    joined: created.joined,
    notifyChat,
  });
  return created;
}
