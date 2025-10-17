import { MAX_CLOCK_SKEW_MS } from "@/lib/constants/presence";
import { getAdminAuth, getAdminRtdb } from "@/lib/server/firebaseAdmin";
import { logDebug, logError } from "@/lib/utils/log";
import * as admin from "firebase-admin";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type HeartbeatPayload = {
  roomId?: string;
  uid?: string;
  connId?: string;
  token?: string;
  reason?: string;
};

const normalizeId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export async function POST(req: NextRequest) {
  let payload: HeartbeatPayload | null = null;
  try {
    payload = (await req.json()) as HeartbeatPayload;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const roomId = normalizeId(payload?.roomId);
  const uid = normalizeId(payload?.uid);
  const connId = normalizeId(payload?.connId);
  const token = normalizeId(payload?.token);

  if (!roomId || !uid || !connId || !token) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    if (decoded.uid !== uid) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }
  } catch (error) {
    logError("presence", "beacon-auth-failed", error);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getAdminRtdb();
  if (!db) {
    return NextResponse.json({ error: "rtdb_unavailable" }, { status: 503 });
  }

  try {
    await db
      .ref(`presence/${roomId}/${uid}/${connId}`)
      .update({
        online: true,
        ts: admin.database.ServerValue.TIMESTAMP,
      });
    logDebug("presence", "beacon-heartbeat", {
      roomId,
      uid,
      connId,
      reason: payload?.reason || "beacon",
      skewTolerance: MAX_CLOCK_SKEW_MS,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("presence", "beacon-heartbeat-error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
