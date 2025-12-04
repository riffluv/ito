import { APP_VERSION } from "@/lib/constants/appVersion";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import type { RoomDoc } from "@/lib/types";

export type RoomVersionCheckResult =
  | { ok: true; roomVersion: string | null }
  | {
      ok: false;
      error: "room/join/version-mismatch" | "room_not_found" | "client_version_required";
      roomVersion: string | null;
      clientVersion: string | null;
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
  const clientVersion = normalizeVersion(clientVersionInput) ?? normalizeVersion(APP_VERSION) ?? null;

  if (!clientVersion) {
    return {
      ok: false,
      error: "client_version_required",
      roomVersion: null,
      clientVersion: null,
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
      status: 404,
    };
  }

  const data = snap.data() as Partial<RoomDoc> | undefined;
  const roomVersion = normalizeVersion(data?.appVersion);

  if (roomVersion && !versionsEqual(roomVersion, clientVersion)) {
    return {
      ok: false,
      error: "room/join/version-mismatch",
      roomVersion,
      clientVersion,
      status: 409,
    };
  }

  return { ok: true, roomVersion: roomVersion ?? null };
}
