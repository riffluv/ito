import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin";
import { leaveRoomServer } from "@/lib/server/roomActions";

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

  const token = typeof payload?.token === "string" ? payload.token : null;
  const callerUid = typeof payload?.callerUid === "string" ? payload.callerUid : null;
  const targets: string[] = Array.isArray(payload?.targets)
    ? (payload.targets as unknown[]).filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];

  if (!token || !callerUid || targets.length === 0) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (decoded.uid !== callerUid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }
  } catch (error) {
    console.error("prune-route verify failed", error);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const roomSnap = await db.collection("rooms").doc(roomId).get();
    if (!roomSnap.exists) {
      return NextResponse.json({ error: "room_not_found" }, { status: 404 });
    }
    const hostId = (roomSnap.data() as any)?.hostId;
    if (hostId !== callerUid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const uniqueTargets = Array.from(new Set<string>(targets)).filter((id) => id !== callerUid);
    if (uniqueTargets.length === 0) {
      return NextResponse.json({ removed: [], skipped: targets, failed: [] });
    }

    const playersRef = db.collection("rooms").doc(roomId).collection("players");
    const removed: string[] = [];
    const failed: string[] = [];

    for (const target of uniqueTargets) {
      try {
        const snap = await playersRef.doc(target).get();
        if (!snap.exists) {
          continue;
        }
        const data = snap.data() as any;
        const displayName =
          typeof data?.name === "string" && data.name.trim() ? data.name.trim() : target;
        await leaveRoomServer(roomId, target, displayName);
        removed.push(target);
      } catch (error) {
        console.error("prune-route leave failed", roomId, target, error);
        failed.push(target);
      }
    }

    return NextResponse.json({ removed, failed });
  } catch (error) {
    console.error("prune-route error", roomId, error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
