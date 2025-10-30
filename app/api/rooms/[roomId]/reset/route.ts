import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin";
import { composeWaitingResetPayload } from "@/lib/server/roomActions";
import { logDebug, logError } from "@/lib/utils/log";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ResetRouteTestOverrides = {
  auth?: ReturnType<typeof getAdminAuth>;
  db?: ReturnType<typeof getAdminDb>;
};

let testOverrides: ResetRouteTestOverrides | null = null;

function resolveAdminAuth() {
  return testOverrides?.auth ?? getAdminAuth();
}

function resolveAdminDb() {
  return testOverrides?.db ?? getAdminDb();
}

declare global {
  // eslint-disable-next-line no-var
  var __setResetRouteOverrides:
    | ((overrides: ResetRouteTestOverrides | null) => void)
    | undefined;
}

globalThis.__setResetRouteOverrides = (overrides) => {
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

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const body =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;

  const token = typeof body?.token === "string" ? (body.token as string) : null;
  const recallSpectators =
    typeof body?.recallSpectators === "boolean"
      ? (body.recallSpectators as boolean)
      : undefined;

  if (!token) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  let requesterUid: string | null = null;
  let isAdmin = false;
  try {
    const decoded = await resolveAdminAuth().verifyIdToken(token);
    requesterUid = decoded.uid ?? null;
    isAdmin = decoded.admin === true;
  } catch (error) {
    logError("rooms", "reset-route verify failed", { roomId, error });
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
      typeof roomData?.creatorId === "string"
        ? (roomData.creatorId as string)
        : null;

    const authorized =
      isAdmin || requesterUid === hostId || requesterUid === creatorId;

    if (!authorized) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const resetPayload = composeWaitingResetPayload({
      recallOpen: recallSpectators,
      resetRound: true,
      clearTopic: true,
      closedAt: null,
      expiresAt: null,
    });

    const recallOpen =
      typeof resetPayload["ui.recallOpen"] === "boolean"
        ? (resetPayload["ui.recallOpen"] as boolean)
        : true;

    logDebug("rooms", "reset-request", { roomId, recallOpen });

    await roomRef.update(resetPayload);

    logDebug("rooms", "reset-success", { roomId, recallOpen });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("rooms", "reset-route error", { roomId, error });
    return NextResponse.json({ error: "reset_failed" }, { status: 500 });
  }
}
