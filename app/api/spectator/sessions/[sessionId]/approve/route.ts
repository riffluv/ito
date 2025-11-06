import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin";
import { logDebug, logError } from "@/lib/utils/log";

export const runtime = "nodejs";

type SessionApproveOverrides = {
  auth?: ReturnType<typeof getAdminAuth>;
  db?: ReturnType<typeof getAdminDb>;
  now?: () => number;
};

let overrides: SessionApproveOverrides | null = null;

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
  var __setSpectatorSessionApproveOverrides:
    | ((value: SessionApproveOverrides | null) => void)
    | undefined;
}

globalThis.__setSpectatorSessionApproveOverrides = (value) => {
  if (process.env.NODE_ENV !== "test") return;
  overrides = value;
};

type IncomingBody = {
  token?: unknown;
  roomId?: unknown;
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
    logError("spectator", "session-approve-auth-failed", { sessionId, roomId, error });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!requesterUid && !isAdmin) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = resolveDb();
    const sessionRef = db.collection("spectatorSessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    }

    const session = sessionSnap.data() as Record<string, unknown>;
    if (session.roomId !== roomId) {
      return NextResponse.json({ error: "room_mismatch" }, { status: 400 });
    }

    const roomRef = db.collection("rooms").doc(roomId);
    const roomSnap = await roomRef.get();
    if (!roomSnap.exists) {
      return NextResponse.json({ error: "room_not_found" }, { status: 404 });
    }
    const room = roomSnap.data() as Record<string, unknown> | undefined;
    const hostId =
      typeof room?.hostId === "string" ? (room.hostId as string) : null;
    const creatorId =
      typeof room?.creatorId === "string" ? (room.creatorId as string) : null;

    const authorized =
      isAdmin || requesterUid === hostId || requesterUid === creatorId;
    if (!authorized) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const rejoinRequest = session.rejoinRequest as Record<string, unknown> | null | undefined;
    if (!rejoinRequest || rejoinRequest.status !== "pending") {
      return NextResponse.json({ error: "rejoin_not_pending" }, { status: 409 });
    }

    const nowMillis = resolveNow();
    const now = Timestamp.fromMillis(nowMillis);
    const source =
      typeof rejoinRequest.source === "string" &&
      (rejoinRequest.source === "auto" || rejoinRequest.source === "manual")
        ? rejoinRequest.source
        : "manual";
    const createdAt =
      rejoinRequest.createdAt instanceof Timestamp
        ? rejoinRequest.createdAt
        : typeof rejoinRequest.createdAt === "number"
        ? Timestamp.fromMillis(rejoinRequest.createdAt)
        : now;

    await sessionRef.update({
      status: "rejoinApproved",
      updatedAt: now,
      rejoinRequest: {
        status: "accepted",
        source,
        createdAt,
        resolvedAt: now,
        resolvedBy: requesterUid ?? null,
        reason: null,
      },
    });

    logDebug("spectator", "session-rejoin-approved", {
      sessionId,
      roomId,
      resolvedBy: requesterUid,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    logError("spectator", "session-approve-error", { sessionId, roomId, error });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

