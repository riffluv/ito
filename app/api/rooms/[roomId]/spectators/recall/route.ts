import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin";
import { checkRoomVersionGuard } from "@/lib/server/roomVersionGate";
import { logDebug, logError } from "@/lib/utils/log";

export const runtime = "nodejs";

type RecallRouteTestOverrides = {
  auth?: ReturnType<typeof getAdminAuth>;
  db?: ReturnType<typeof getAdminDb>;
};

type SpectatorRecallRequestBody = {
  token?: unknown;
  clientVersion?: unknown;
};

let testOverrides: RecallRouteTestOverrides | null = null;

function resolveAdminAuth() {
  return testOverrides?.auth ?? getAdminAuth();
}

function resolveAdminDb() {
  return testOverrides?.db ?? getAdminDb();
}

declare global {
  // eslint-disable-next-line no-var
  var __setSpectatorRecallRouteOverrides:
    | ((overrides: RecallRouteTestOverrides | null) => void)
    | undefined;
}

globalThis.__setSpectatorRecallRouteOverrides = (overrides) => {
  if (process.env.NODE_ENV !== "test") return;
  testOverrides = overrides;
};

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const roomId = params?.roomId;
  if (!roomId) {
    return NextResponse.json({ error: "room_id_required" }, { status: 400 });
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  let token: string | null = null;
  let clientVersion: string | null = null;
  if (typeof body === "object" && body !== null) {
    const maybeToken = (body as SpectatorRecallRequestBody).token;
    if (typeof maybeToken === "string") {
      token = maybeToken;
    }
    const maybeClientVersion = (body as SpectatorRecallRequestBody).clientVersion;
    if (typeof maybeClientVersion === "string") {
      clientVersion = maybeClientVersion;
    }
  }
  if (!token) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const guard = await checkRoomVersionGuard(roomId, clientVersion);
  if (!guard.ok) {
    return NextResponse.json(
      {
        error: guard.error,
        roomVersion: guard.roomVersion,
        clientVersion: guard.clientVersion,
        serverVersion: guard.serverVersion,
        mismatchType: guard.mismatchType,
      },
      { status: guard.status }
    );
  }

  let requesterUid: string | null = null;
  let isAdmin = false;
  try {
    const decoded = await resolveAdminAuth().verifyIdToken(token);
    requesterUid = decoded.uid ?? null;
    isAdmin = decoded.admin === true;
  } catch (error) {
    logError("rooms", "spectator-recall-verify-failed", { roomId, error });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!requesterUid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = resolveAdminDb();
    const roomRef = db.collection("rooms").doc(roomId);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) {
      return NextResponse.json({ error: "room_not_found" }, { status: 404 });
    }
    const roomData = roomSnap.data() as Record<string, unknown> | undefined;
    const hostId =
      typeof roomData?.hostId === "string" ? (roomData.hostId as string) : null;
    const creatorId =
      typeof roomData?.creatorId === "string" ? (roomData.creatorId as string) : null;
    const roomStatus =
      typeof roomData?.status === "string" ? (roomData.status as string) : "waiting";

    const authorized = isAdmin || requesterUid === hostId || requesterUid === creatorId;
    if (!authorized) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (roomStatus !== "waiting") {
      return NextResponse.json({ error: "not_waiting" }, { status: 409 });
    }

    logDebug("rooms", "spectator-recall-request", {
      roomId,
      requesterUid,
    });

    await roomRef.update({
      "ui.recallOpen": true,
      lastActiveAt: FieldValue.serverTimestamp(),
    });

    logDebug("rooms", "spectator-recall-success", {
      roomId,
      requesterUid,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("rooms", "spectator-recall-error", { roomId, error });
    return NextResponse.json({ error: "recall_failed" }, { status: 500 });
  }
}
