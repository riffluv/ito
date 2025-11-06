import { randomUUID } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin";
import { logDebug, logError } from "@/lib/utils/log";

export const runtime = "nodejs";

type SpectatorInviteRouteOverrides = {
  auth?: ReturnType<typeof getAdminAuth>;
  db?: ReturnType<typeof getAdminDb>;
  now?: () => number;
  randomId?: () => string;
};

let overrides: SpectatorInviteRouteOverrides | null = null;

function resolveAdminAuth() {
  return overrides?.auth ?? getAdminAuth();
}

function resolveAdminDb() {
  return overrides?.db ?? getAdminDb();
}

function resolveNow() {
  return overrides?.now?.() ?? Date.now();
}

function generateInviteId() {
  return overrides?.randomId?.() ?? randomUUID();
}

declare global {
  // eslint-disable-next-line no-var
  var __setSpectatorInviteRouteOverrides:
    | ((nextOverrides: SpectatorInviteRouteOverrides | null) => void)
    | undefined;
}

globalThis.__setSpectatorInviteRouteOverrides = (nextOverrides) => {
  if (process.env.NODE_ENV !== "test") return;
  overrides = nextOverrides;
};

const SPECTATOR_INVITES_COLLECTION = "spectatorInvites";
const ROOMS_COLLECTION = "rooms";
const MODE_PRIVATE = "private";
const ALLOWED_MODES = new Set(["private", "public"]);
const MAX_MAX_USES = 20;
const MIN_EXPIRY_MINUTES = 5;
const MAX_EXPIRY_MINUTES = 24 * 60;

type IncomingBody = {
  token?: unknown;
  roomId?: unknown;
  mode?: unknown;
  maxUses?: unknown;
  expiresInMinutes?: unknown;
  flags?: unknown;
};

type SpectatorInviteResponse = {
  ok: true;
  invite: {
    id: string;
    roomId: string;
    mode: string;
    maxUses: number | null;
    expiresAt: number | null;
    flags: Record<string, unknown> | null;
  };
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function sanitizeFlags(flags: unknown): Record<string, unknown> | null {
  if (!isPlainRecord(flags)) return null;
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(flags)) {
    if (typeof key !== "string" || key.length === 0) continue;
    result[key.slice(0, 40)] = val;
  }
  return Object.keys(result).length > 0 ? result : null;
}

function resolveMode(raw: unknown): string {
  if (typeof raw === "string" && ALLOWED_MODES.has(raw)) {
    return raw;
  }
  return MODE_PRIVATE;
}

function resolveMaxUses(raw: unknown): number | null | "invalid" {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "number" && typeof raw !== "string") return "invalid";
  const parsed =
    typeof raw === "number" ? raw : Number.parseInt(raw as string, 10);
  if (!Number.isFinite(parsed)) return "invalid";
  const integer = Math.trunc(parsed);
  if (integer < 1 || integer > MAX_MAX_USES) {
    return "invalid";
  }
  return integer;
}

function resolveExpiryMinutes(raw: unknown): number | null | "invalid" {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "number" && typeof raw !== "string") return "invalid";
  const parsed =
    typeof raw === "number" ? raw : Number.parseInt(raw as string, 10);
  if (!Number.isFinite(parsed)) return "invalid";
  const minutes = Math.trunc(parsed);
  if (minutes < MIN_EXPIRY_MINUTES || minutes > MAX_EXPIRY_MINUTES) {
    return "invalid";
  }
  return minutes;
}

export async function POST(req: NextRequest) {
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

  const maxUses = resolveMaxUses(payload.maxUses);
  if (maxUses === "invalid") {
    return NextResponse.json({ error: "invalid_max_uses" }, { status: 400 });
  }

  const expiresInMinutes = resolveExpiryMinutes(payload.expiresInMinutes);
  if (expiresInMinutes === "invalid") {
    return NextResponse.json(
      { error: "invalid_expires_in" },
      { status: 400 }
    );
  }

  const mode = resolveMode(payload.mode);
  const flags = sanitizeFlags(payload.flags);

  let requesterUid: string | null = null;
  let isAdmin = false;
  try {
    const decoded = await resolveAdminAuth().verifyIdToken(token);
    requesterUid = typeof decoded.uid === "string" ? decoded.uid : null;
    isAdmin = decoded.admin === true;
  } catch (error) {
    logError("spectator", "invite-auth-verify-failed", { roomId, error });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!requesterUid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = resolveAdminDb();
    const roomDoc = await db.collection(ROOMS_COLLECTION).doc(roomId).get();
    if (!roomDoc.exists) {
      return NextResponse.json({ error: "room_not_found" }, { status: 404 });
    }
    const roomData = roomDoc.data() as Record<string, unknown> | undefined;
    const hostId =
      typeof roomData?.hostId === "string" ? (roomData.hostId as string) : null;
    const creatorId =
      typeof roomData?.creatorId === "string"
        ? (roomData.creatorId as string)
        : null;

    const authorized =
      isAdmin || requesterUid === hostId || requesterUid === creatorId;
    if (!authorized) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const inviteId = generateInviteId();
    const now = resolveNow();
    const expiresAtMillis =
      typeof expiresInMinutes === "number"
        ? now + expiresInMinutes * 60 * 1000
        : null;
    const inviteDocRef = db
      .collection(SPECTATOR_INVITES_COLLECTION)
      .doc(inviteId);

    const inviteRecord: Record<string, unknown> = {
      roomId,
      issuerUid: requesterUid,
      mode,
      usedCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (typeof maxUses === "number") {
      inviteRecord.maxUses = maxUses;
    }
    if (expiresAtMillis !== null) {
      inviteRecord.expiresAt = Timestamp.fromMillis(expiresAtMillis);
    }
    if (flags) {
      inviteRecord.flags = flags;
    }

    logDebug("spectator", "invite-create-request", {
      inviteId,
      roomId,
      mode,
      maxUses: typeof maxUses === "number" ? maxUses : null,
      expiresInMinutes: expiresInMinutes ?? null,
      hasFlags: !!flags,
    });

    await inviteDocRef.set(inviteRecord);

    logDebug("spectator", "invite-create-success", {
      inviteId,
      roomId,
    });

    const response: SpectatorInviteResponse = {
      ok: true,
      invite: {
        id: inviteId,
        roomId,
        mode,
        maxUses: typeof maxUses === "number" ? maxUses : null,
        expiresAt: expiresAtMillis,
        flags: flags ?? null,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logError("spectator", "invite-create-error", { roomId, error });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

