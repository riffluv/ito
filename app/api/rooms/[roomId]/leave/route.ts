import { getAdminAuth } from "@/lib/server/firebaseAdmin";
import { leaveRoomServer } from "@/lib/server/roomActions";
import { logError } from "@/lib/utils/log";
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
  const displayName =
    typeof body?.displayName === "string" ? (body.displayName as string) : null;

  if (!uid || !token) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (decoded.uid !== uid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }
  } catch (error) {
    logError("rooms", "leave-route verify failed", error);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await leaveRoomServer(roomId, uid, displayName);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("rooms", "leave-route error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
