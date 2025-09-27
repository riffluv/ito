import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin";
import { transferHostServer } from "@/lib/server/roomActions";

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

  const targetUid = typeof payload?.targetUid === "string" ? payload.targetUid : null;
  const token = typeof payload?.token === "string" ? payload.token : null;

  if (!targetUid || !token) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const requesterUid = decoded.uid;
    const isAdmin = decoded.admin === true;

    if (!isAdmin) {
      const roomSnap = await getAdminDb().collection("rooms").doc(roomId).get();
      if (!roomSnap.exists) {
        return NextResponse.json({ error: "room_not_found" }, { status: 404 });
      }
      const currentHost = (roomSnap.data() as any)?.hostId;
      if (!currentHost || currentHost !== requesterUid) {
        return NextResponse.json({ error: "not_host" }, { status: 403 });
      }
    }

    await transferHostServer(roomId, requesterUid, targetUid, { isAdmin });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    const code = typeof error?.message === "string" ? error.message : "transfer_failed";
    const status =
      code === "room-not-found" || code === "room_not_found"
        ? 404
        : code === "target-not-found"
        ? 404
        : code === "not-host"
        ? 403
        : 500;
    return NextResponse.json({ error: code }, { status });
  }
}
