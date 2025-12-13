import { getAdminAuth } from "@/lib/server/firebaseAdmin";
import { ensureHostAssignedServer } from "@/lib/server/roomActions";
import { checkRoomVersionGuard } from "@/lib/server/roomVersionGate";
import { logDebug, logError } from "@/lib/utils/log";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

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

  const uid = typeof body?.uid === "string" ? (body.uid as string) : null;
  const token = typeof body?.token === "string" ? (body.token as string) : null;
  const clientVersion =
    typeof body?.clientVersion === "string" ? (body.clientVersion as string) : null;

  if (!uid || !token) {
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

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (decoded.uid !== uid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }
  } catch (error) {
    logError("rooms", "claim-host verify failed", error);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  logDebug("rooms", "host-claim request", { roomId, uid });
  try {
    await ensureHostAssignedServer(roomId, uid);
    logDebug("rooms", "host-claim assigned", { roomId, uid });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("rooms", "claim-host error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
