import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRoomVersionGuard } from "@/lib/server/roomVersionGate";
import { nextRoundCommand } from "@/lib/server/roomCommands";
import { traceError } from "@/lib/utils/trace";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(1),
  sessionId: z.string().min(8).max(128).optional().nullable(),
  clientVersion: z.string().optional().nullable(),
  // お題タイプ（省略時は room.options.defaultTopicType）
  topicType: z.string().optional().nullable(),
  // カスタムお題（topicType が "カスタム" の場合）
  customTopic: z.string().optional().nullable(),
  requestId: z.string().min(8).max(64),
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
    const result = await nextRoundCommand({
      roomId,
      token: parsed.data.token,
      sessionId: parsed.data.sessionId ?? undefined,
      topicType: parsed.data.topicType ?? undefined,
      customTopic: parsed.data.customTopic ?? undefined,
      requestId: parsed.data.requestId,
    });
    return NextResponse.json(result);
  } catch (error) {
    traceError("room.nextRound.api", error, { roomId });
    const code = (error as { code?: string }).code;
    const reason = (error as { reason?: string }).reason;
    const status =
      code === "unauthorized"
        ? 401
        : code === "forbidden"
          ? 403
          : code === "invalid_status"
            ? 409
            : code === "rate_limited"
              ? 429
              : code === "no_players"
                ? 400
                : 500;
    return NextResponse.json({ error: code ?? "internal_error", reason }, { status });
  }
}
