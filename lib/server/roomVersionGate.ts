import { APP_VERSION } from "@/lib/constants/appVersion";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import type { RoomDoc } from "@/lib/types";

export type RoomVersionMismatchType = "client_outdated" | "room_outdated" | "unknown";

export type RoomVersionCheckResult =
  | { ok: true; roomVersion: string | null; serverVersion: string | null }
  | {
      ok: false;
      error: "room/join/version-mismatch" | "room_not_found" | "client_version_required";
      roomVersion: string | null;
      clientVersion: string | null;
      serverVersion: string | null;
      mismatchType?: RoomVersionMismatchType;
      status: number;
    };

export const normalizeVersion = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const paren = trimmed.indexOf(" (");
  return paren > 0 ? trimmed.slice(0, paren).trim() : trimmed;
};

const isDevish = (value: string | null) =>
  value === "dev" || value === "development" || value === "local";

export const versionsEqual = (a: string | null, b: string | null): boolean => {
  const isProd = process.env.NODE_ENV === "production";
  if (!a || !b) return false;
  if (a === b) return true;
  if (isDevish(a) && isDevish(b)) return true;
  if (!isProd && (isDevish(a) || isDevish(b))) return true;
  return false;
};

/**
 * Server-side guard to ensure a client joins a room only when versions match.
 * - If the room has an appVersion and it differs from clientVersion, returns a mismatch.
 * - If the room lacks appVersion (legacy data), it allows join (ok: true).
 */
export async function checkRoomVersionGuard(
  roomId: string,
  clientVersionInput: unknown
): Promise<RoomVersionCheckResult> {
  const clientVersion = normalizeVersion(clientVersionInput);
  const serverVersion = normalizeVersion(APP_VERSION);

  if (!clientVersion) {
    return {
      ok: false,
      error: "client_version_required",
      roomVersion: null,
      clientVersion: null,
      serverVersion: serverVersion ?? null,
      status: 400,
    };
  }

  const snap = await getAdminDb().collection("rooms").doc(roomId).get();
  if (!snap.exists) {
    return {
      ok: false,
      error: "room_not_found",
      roomVersion: null,
      clientVersion,
      serverVersion: serverVersion ?? null,
      status: 404,
    };
  }

  const data = snap.data() as Partial<RoomDoc> | undefined;
  const roomVersion = normalizeVersion(data?.appVersion);

  if (roomVersion && !versionsEqual(roomVersion, clientVersion)) {
    const mismatchType: RoomVersionMismatchType =
      serverVersion && versionsEqual(roomVersion, serverVersion)
        ? "client_outdated"
        : serverVersion
          ? "room_outdated"
          : "unknown";
    return {
      ok: false,
      error: "room/join/version-mismatch",
      roomVersion,
      clientVersion,
      serverVersion: serverVersion ?? null,
      mismatchType,
      status: 409,
    };
  }

  // TODO: legacy room without appVersion; consider blocking join after migration period.
  // 移行期間中の古いルームは appVersion が未設定の場合があり、現状は許可している。
  // 十分な移行期間が経過したら、appVersion がないルームへの join もブロックすることを検討。
  return { ok: true, roomVersion: roomVersion ?? null, serverVersion: serverVersion ?? null };
}
