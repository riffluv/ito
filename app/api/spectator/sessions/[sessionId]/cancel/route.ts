import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin";
import { logDebug, logError } from "@/lib/utils/log";
import { checkRoomVersionGuard } from "@/lib/server/roomVersionGate";

export const runtime = "nodejs";

type SessionCancelOverrides = {
  auth?: ReturnType<typeof getAdminAuth>;
  db?: ReturnType<typeof getAdminDb>;
  now?: () => number;
};

let overrides: SessionCancelOverrides | null = null;

function resolveAuth() {
  return overrides?.auth ?? getAdminAuth();
}

function resolveDb() {
  return overrides?.db ?? getAdminDb();
}

function resolveNow() {
  return overrides?.now?.() ?? Date.now();
}

declare global {
  // eslint-disable-next-line no-var
  var __setSpectatorSessionCancelOverrides:
    | ((value: SessionCancelOverrides | null) => void)
    | undefined;
}

globalThis.__setSpectatorSessionCancelOverrides = (value) => {
  if (process.env.NODE_ENV !== "test") return;
  overrides = value;
};

type IncomingBody = {
  token?: unknown;
  roomId?: unknown;
  clientVersion?: unknown;
};

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const sessionId = params?.sessionId;
  if (!sessionId) {
    return NextResponse.json({ error: "session_id_required" }, { status: 400 });
  }

  let payload: IncomingBody;
  try {
    payload = (await req.json()) as IncomingBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const token = typeof payload.token === "string" ? payload.token : null;
  const roomId =
    typeof payload.roomId === "string" && payload.roomId.trim().length > 0
      ? payload.roomId.trim()
      : null;
  const clientVersion = payload.clientVersion;

  if (!token) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }
  if (!roomId) {
    return NextResponse.json({ error: "room_id_required" }, { status: 400 });
  }

  let requesterUid: string | null = null;
  let isAdmin = false;
  try {
    const decoded = await resolveAuth().verifyIdToken(token);
    requesterUid = typeof decoded.uid === "string" ? decoded.uid : null;
    isAdmin = decoded.admin === true;
  } catch (error) {
    logError("spectator", "session-cancel-auth-failed", { sessionId, roomId, error });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!requesterUid && !isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const versionCheck = await checkRoomVersionGuard(roomId, clientVersion, { db: resolveDb() });
    if (!versionCheck.ok) {
      return NextResponse.json(
        {
          error: versionCheck.error,
          roomVersion: versionCheck.roomVersion,
          clientVersion: versionCheck.clientVersion,
        },
        { status: versionCheck.status }
      );
    }

    const db = resolveDb();
    const sessionRef = db.collection("spectatorSessions").doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    }

    const session = snap.data() as Record<string, unknown>;
    if (session.roomId !== roomId) {
      return NextResponse.json({ error: "room_mismatch" }, { status: 400 });
    }
    const viewerUid =
      typeof session.viewerUid === "string" && session.viewerUid.length > 0
        ? (session.viewerUid as string)
        : null;
    if (!isAdmin && viewerUid && viewerUid !== requesterUid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const now = Timestamp.fromMillis(resolveNow());
    await sessionRef.update({
      status: "watching",
      updatedAt: now,
      rejoinRequest: null,
    });

    logDebug("spectator", "session-rejoin-cancel", {
      sessionId,
      roomId,
      viewerUid,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    logError("spectator", "session-cancel-error", { sessionId, roomId, error });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
