import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRoomVersionGuard } from "@/lib/server/roomVersionGate";
import { commitPlayFromClueCommand } from "@/lib/server/roomCommands";
import { traceError } from "@/lib/utils/trace";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(1),
  playerId: z.string().min(1),
  clientVersion: z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const roomId = params?.roomId;
  if (!roomId) {
    return NextResponse.json({ error: "room_id_required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const guard = await checkRoomVersionGuard(roomId, parsed.data.clientVersion);
  if (!guard.ok) {
    return NextResponse.json(
      {
        error: guard.error,
        roomVersion: guard.roomVersion,
        clientVersion: guard.clientVersion,
      },
      { status: guard.status }
    );
  }

  try {
    await commitPlayFromClueCommand({
      roomId,
      token: parsed.data.token,
      playerId: parsed.data.playerId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    traceError("room.commitPlay.api", error, { roomId });
    const code = (error as { code?: string }).code;
    const reason = (error as { reason?: string }).reason;
    const status =
      code === "unauthorized"
        ? 401
        : code === "room_not_found"
          ? 404
          : code === "forbidden"
            ? 403
            : 500;
    return NextResponse.json({ error: code ?? "internal_error", reason }, { status });
  }
}
