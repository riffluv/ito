import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRoomVersionGuard } from "@/lib/server/roomVersionGate";
import { joinRoom } from "@/lib/server/roomCommands";
import { traceError } from "@/lib/utils/trace";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(1),
  displayName: z.string().optional().nullable(),
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
    const result = await joinRoom({
      roomId,
      token: parsed.data.token,
      displayName: parsed.data.displayName ?? null,
    });
    return NextResponse.json({ ok: true, joined: result.joined, avatar: result.avatar ?? null });
  } catch (error) {
    traceError("room.join.api", error, { roomId });
    const code = (error as { code?: string }).code;
    const status =
      code === "unauthorized"
        ? 401
        : code === "room_not_found"
          ? 404
          : code === "room_in_progress" || code === "room_recall_closed"
          ? 409
            : 500;
    return NextResponse.json(
      { error: code ?? "internal_error", message: (error as Error | undefined)?.message },
      { status }
    );
  }
}
