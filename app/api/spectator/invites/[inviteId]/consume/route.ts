import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Timestamp } from "firebase-admin/firestore";

import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin";
import { logDebug, logError } from "@/lib/utils/log";
import { checkRoomVersionGuard } from "@/lib/server/roomVersionGate";

export const runtime = "nodejs";

type SpectatorSessionMode = "private" | "public";

type SpectatorInviteDoc = {
  roomId?: string | null;
  expiresAt?: Timestamp | number | null;
  maxUses?: number | null;
  usedCount?: number | null;
  mode?: SpectatorSessionMode | string | null;
  flags?: Record<string, unknown> | null;
};

type ConsumeInviteOverrides = {
  auth?: ReturnType<typeof getAdminAuth>;
  db?: ReturnType<typeof getAdminDb>;
  now?: () => number;
  randomId?: () => string;
};

let overrides: ConsumeInviteOverrides | null = null;

function resolveAuth() {
  return overrides?.auth ?? getAdminAuth();
}

function resolveDb() {
  return overrides?.db ?? getAdminDb();
}

function resolveNow() {
  return overrides?.now?.() ?? Date.now();
}

function generateSessionId() {
  return overrides?.randomId?.() ?? randomUUID();
}

declare global {
  // eslint-disable-next-line no-var
  var __setSpectatorConsumeRouteOverrides:
    | ((value: ConsumeInviteOverrides | null) => void)
    | undefined;
}

globalThis.__setSpectatorConsumeRouteOverrides = (value) => {
  if (process.env.NODE_ENV !== "test") return;
  overrides = value;
};

type IncomingBody = {
  token?: unknown;
  roomId?: unknown;
  viewerUid?: unknown;
  clientVersion?: unknown;
};

export async function POST(
  req: NextRequest,
  { params }: { params: { inviteId: string } }
) {
  const inviteId = params?.inviteId;
  if (!inviteId) {
    return NextResponse.json({ error: "invite_id_required" }, { status: 400 });
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
  const requestedViewerUid =
    typeof payload.viewerUid === "string" && payload.viewerUid.trim().length > 0
      ? payload.viewerUid.trim()
      : null;

  if (!roomId) {
    return NextResponse.json({ error: "room_id_required" }, { status: 400 });
  }

  let verifiedUid: string | null = null;
  if (token) {
    try {
      const decoded = await resolveAuth().verifyIdToken(token);
      verifiedUid = typeof decoded.uid === "string" ? decoded.uid : null;
    } catch (error) {
      logError("spectator", "invite-consume-auth-failed", { inviteId, roomId, error });
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  if (requestedViewerUid && verifiedUid && requestedViewerUid !== verifiedUid) {
    return NextResponse.json({ error: "viewer_mismatch" }, { status: 403 });
  }

  const viewerUid = verifiedUid ?? requestedViewerUid ?? null;

  try {
    const versionCheck = await checkRoomVersionGuard(roomId, clientVersion);
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
    const inviteRef = db.collection("spectatorInvites").doc(inviteId);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      return NextResponse.json({ error: "invite_not_found" }, { status: 404 });
    }

    const invite = inviteSnap.data() as SpectatorInviteDoc | undefined;
    if (!invite || invite.roomId !== roomId) {
      return NextResponse.json({ error: "invite_room_mismatch" }, { status: 400 });
    }

    const expiresAt =
      invite.expiresAt instanceof Timestamp
        ? invite.expiresAt.toMillis()
        : typeof invite.expiresAt === "number"
        ? invite.expiresAt
        : null;
    if (typeof expiresAt === "number" && resolveNow() > expiresAt) {
      return NextResponse.json({ error: "invite_expired" }, { status: 400 });
    }

    const maxUses =
      typeof invite.maxUses === "number" && Number.isFinite(invite.maxUses)
        ? invite.maxUses
        : null;
    const usedCount =
      typeof invite.usedCount === "number" && Number.isFinite(invite.usedCount)
        ? invite.usedCount
        : 0;
    if (maxUses !== null && usedCount >= maxUses) {
      return NextResponse.json({ error: "invite_limit_reached" }, { status: 400 });
    }

    const sessionId = generateSessionId();
    const mode: SpectatorSessionMode =
      invite.mode === "public" || invite.mode === "private" ? invite.mode : "private";

    const now = resolveNow();
    const sessionRef = db.collection("spectatorSessions").doc(sessionId);
    await sessionRef.set({
      roomId,
      viewerUid,
      inviteId,
      status: "watching",
      mode,
      rejoinRequest: null,
      createdAt: Timestamp.fromMillis(now),
      updatedAt: Timestamp.fromMillis(now),
      flags: invite.flags ?? {},
      endReason: null,
    });

    await inviteRef.update({
      usedCount: usedCount + 1,
      updatedAt: Timestamp.fromMillis(now),
    });

    logDebug("spectator", "invite-consume-success", {
      inviteId,
      roomId,
      sessionId,
      viewerUid,
      mode,
    });

    return NextResponse.json(
      {
        ok: true,
        sessionId,
        mode,
        inviteId,
        flags: invite.flags ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    logError("spectator", "invite-consume-error", { inviteId, roomId, error });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
