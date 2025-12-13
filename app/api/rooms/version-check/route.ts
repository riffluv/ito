import { APP_VERSION } from "@/lib/constants/appVersion";
import { logError, logDebug } from "@/lib/utils/log";
import {
  checkRoomVersionGuard,
  normalizeVersion,
  versionsEqual,
  type RoomVersionMismatchType,
} from "@/lib/server/roomVersionGate";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type VersionCheckBody = {
  clientVersion?: unknown;
  roomId?: unknown;
};

type ErrorResponse = {
  error: string;
  roomVersion?: string | null;
  clientVersion?: string;
  serverVersion?: string | null;
  mismatchType?: RoomVersionMismatchType;
};

function invalidBody(reason: string) {
  return NextResponse.json({ error: reason }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    let payload: VersionCheckBody;
    try {
      payload = (await req.json()) as VersionCheckBody;
    } catch {
      return invalidBody("invalid_body");
    }

    const clientVersionRaw =
      typeof payload?.clientVersion === "string" ? payload.clientVersion.trim() : "";
    const clientVersion = normalizeVersion(clientVersionRaw);
    const serverVersion = normalizeVersion(APP_VERSION);

    if (!clientVersion) {
      return invalidBody("client_version_required");
    }

    const roomId =
      typeof payload?.roomId === "string" && payload.roomId.trim().length > 0
        ? payload.roomId.trim()
        : null;

    // Creation preflight (no roomId)
    if (!roomId) {
      if (!versionsEqual(clientVersion, serverVersion)) {
        logDebug("room.versionMismatch", "create-mismatch", {
          role: "create",
          clientVersion,
          serverVersion,
        });
        const body: ErrorResponse = {
          error: "room/create/update-required",
          roomVersion: serverVersion ?? APP_VERSION,
          clientVersion,
        };
        return NextResponse.json(body, { status: 409 });
      }

      return NextResponse.json({ ok: true, appVersion: serverVersion ?? APP_VERSION });
    }

    // Join/check existing room
    const guard = await checkRoomVersionGuard(roomId, clientVersion);
    if (!guard.ok) {
      if (guard.error === "room/join/version-mismatch") {
        logDebug("room.versionMismatch", "join-mismatch", {
          role: "join",
          roomId,
          roomVersion: guard.roomVersion,
          clientVersion: guard.clientVersion,
          serverVersion: guard.serverVersion,
          mismatchType: guard.mismatchType ?? "unknown",
        });
      }
      const body: ErrorResponse = {
        error: guard.error,
        roomVersion: guard.roomVersion,
        clientVersion: guard.clientVersion ?? undefined,
        serverVersion: guard.serverVersion,
        mismatchType: guard.mismatchType,
      };
      return NextResponse.json(body, { status: guard.status });
    }

    // NOTE: legacy room without appVersion may still pass guard (roomVersion is null).
    // Keep returning serverVersion as the best-effort appVersion for the client UI.
    return NextResponse.json({
      ok: true,
      appVersion: guard.roomVersion ?? serverVersion ?? APP_VERSION,
      serverVersion: serverVersion ?? APP_VERSION,
    });
  } catch (error) {
    logError("rooms", "version-check-internal-error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
