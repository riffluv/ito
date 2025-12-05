import { NextRequest, NextResponse } from "next/server";
import { leaveRoomSchema } from "@/lib/schema/roomLeave";
import { leaveRoom } from "@/lib/server/roomCommands";
import { logError } from "@/lib/utils/log";

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

  const parsed = leaveRoomSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { token } = parsed.data;

  try {
    await leaveRoom({ roomId, token });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("rooms", "leave-route error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
