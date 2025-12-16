import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRoomVersionGuard } from "@/lib/server/roomVersionGate";
import { dealNumbersCommand } from "@/lib/server/roomCommands";
import { traceError } from "@/lib/utils/trace";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(1),
  sessionId: z.string().min(8).max(128).optional().nullable(),
  clientVersion: z.string().optional().nullable(),
  skipPresence: z.boolean().optional(),
  requestId: z.string().min(8).max(64),
  presenceUids: z.array(z.string().min(1)).max(16).optional().nullable(),
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
    const count = await dealNumbersCommand({
      roomId,
      token: parsed.data.token,
      sessionId: parsed.data.sessionId ?? undefined,
      skipPresence: parsed.data.skipPresence,
      requestId: parsed.data.requestId,
      presenceUids: parsed.data.presenceUids ?? undefined,
    });
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    traceError("room.deal.api", error, { roomId });
    const code = (error as { code?: string }).code;
    const status =
      code === "unauthorized"
        ? 401
        : code === "room_not_found"
          ? 404
          : code === "forbidden"
            ? 403
            : code === "rate_limited"
              ? 429
              : code === "invalid_status"
                ? 409
              : 500;
    return NextResponse.json({ error: code ?? "internal_error" }, { status });
  }
}
