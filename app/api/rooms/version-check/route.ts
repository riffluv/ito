import { APP_VERSION } from "@/lib/constants/appVersion";
import { getAdminDb } from "@/lib/server/firebaseAdmin";
import type { RoomDoc } from "@/lib/types";
import { logError, logDebug } from "@/lib/utils/log";
import { normalizeVersion, versionsEqual } from "@/lib/server/roomVersionGate";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type VersionCheckBody = {
  clientVersion?: unknown;
  roomId?: unknown;
};

type ErrorResponse = { error: string; roomVersion?: string | null; clientVersion?: string };

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
    const snap = await getAdminDb().collection("rooms").doc(roomId).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "room_not_found" }, { status: 404 });
    }

    const data = snap.data() as Partial<RoomDoc> | undefined;
    const storedVersion = normalizeVersion(data?.appVersion);

    // 移行期間中の古いルームはバージョン未設定の場合がある。その場合は許可する。
    if (storedVersion && !versionsEqual(storedVersion, clientVersion)) {
      logDebug("room.versionMismatch", "join-mismatch", {
        role: "join",
        roomId,
        roomVersion: storedVersion,
        clientVersion,
      });
      const body: ErrorResponse = {
        error: "room/join/version-mismatch",
        roomVersion: storedVersion,
        clientVersion,
      };
      return NextResponse.json(body, { status: 409 });
    }

    return NextResponse.json({ ok: true, appVersion: storedVersion ?? serverVersion ?? APP_VERSION });
  } catch (error) {
    logError("rooms", "version-check-internal-error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
