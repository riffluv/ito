import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin";
import { transferHostServer } from "@/lib/server/roomActions";
import { checkRoomVersionGuard } from "@/lib/server/roomVersionGate";
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

  const targetUid =
    typeof body?.targetUid === "string" ? (body.targetUid as string) : null;
  const token = typeof body?.token === "string" ? (body.token as string) : null;
  const clientVersion =
    typeof body?.clientVersion === "string" ? (body.clientVersion as string) : null;

  if (!targetUid || !token) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
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
    const requesterUid = decoded.uid;
    const isAdmin = decoded.admin === true;

    if (!isAdmin) {
      const roomSnap = await getAdminDb().collection("rooms").doc(roomId).get();
      if (!roomSnap.exists) {
        return NextResponse.json({ error: "room_not_found" }, { status: 404 });
      }
      const roomData = roomSnap.data() as Record<string, unknown> | undefined;
      const currentHost =
        typeof roomData?.hostId === "string" ? roomData.hostId : null;
      if (!currentHost || currentHost !== requesterUid) {
        return NextResponse.json({ error: "not_host" }, { status: 403 });
      }
    }

    await transferHostServer(roomId, requesterUid, targetUid, { isAdmin });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code =
      error instanceof Error && typeof error.message === "string"
        ? error.message
        : "transfer_failed";
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
