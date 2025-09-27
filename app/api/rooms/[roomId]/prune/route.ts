import { getAdminAuth, getAdminDb } from "@/lib/server/firebaseAdmin";
import { leaveRoomServer } from "@/lib/server/roomActions";
import { logError, logInfo } from "@/lib/utils/log";
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

  const token = typeof body?.token === "string" ? (body.token as string) : null;
  const callerUid =
    typeof body?.callerUid === "string" ? (body.callerUid as string) : null;
  const targets: string[] = Array.isArray(body?.targets)
    ? (body?.targets as unknown[]).filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      )
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
    logError("rooms", "prune-route verify failed", error);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = getAdminDb();
    const roomSnap = await db.collection("rooms").doc(roomId).get();
    if (!roomSnap.exists) {
      return NextResponse.json({ error: "room_not_found" }, { status: 404 });
    }
    const roomData = roomSnap.data() as Record<string, unknown> | undefined;
    const hostId =
      typeof roomData?.hostId === "string" ? roomData.hostId : null;
    if (hostId !== callerUid) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const uniqueTargets = Array.from(new Set<string>(targets)).filter(
      (id) => id !== callerUid
    );
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
        const data = snap.data() as Record<string, unknown> | undefined;
        const displayNameCandidate =
          typeof data?.name === "string" && data.name.trim().length > 0
            ? data.name.trim()
            : target;
        const displayName = displayNameCandidate;
        await leaveRoomServer(roomId, target, displayName);
        removed.push(target);
      } catch (error) {
        logError("rooms", "prune-route leave failed", {
          roomId,
          target,
          error,
        });
        failed.push(target);
      }
    }

    logInfo("rooms", "prune-route completed", { roomId, removed, failed });
    return NextResponse.json({ removed, failed });
  } catch (error) {
    logError("rooms", "prune-route error", { roomId, error });
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
