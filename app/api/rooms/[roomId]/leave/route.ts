import { NextRequest, NextResponse } from "next/server";
import { leaveRoomSchema } from "@/lib/schema/roomLeave";
import { checkRoomVersionGuard } from "@/lib/server/roomVersionGate";
import { leaveRoom } from "@/lib/server/roomCommands";
import { traceError } from "@/lib/utils/trace";

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
  const { uid, token, displayName, clientVersion } = parsed.data;

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
    await leaveRoom({ roomId, uid, token, displayName: displayName ?? null });
    return NextResponse.json({ ok: true });
  } catch (error) {
    traceError("room.leave.api", error, { roomId, uid });
    const code = (error as { code?: string }).code;
    const status = code === "unauthorized" ? 401 : code === "forbidden" ? 403 : 500;
    return NextResponse.json(
      { error: code ?? "internal_error", message: (error as Error | undefined)?.message },
      { status }
    );
  }
}
