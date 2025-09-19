import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/server/firebaseAdmin";
import { ensureHostAssignedServer } from "@/lib/server/roomActions";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const roomId = params?.roomId;
  if (!roomId) {
    return NextResponse.json({ error: "room_id_required" }, { status: 400 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const uid = typeof payload?.uid === "string" ? payload.uid : null;
  const token = typeof payload?.token === "string" ? payload.token : null;

  if (!uid || !token) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (decoded.uid !== uid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }
  } catch (error) {
    console.error("claim-host verify failed", error);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await ensureHostAssignedServer(roomId, uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("claim-host error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
