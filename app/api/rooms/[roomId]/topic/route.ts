import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRoomVersionGuard } from "@/lib/server/roomVersionGate";
import { topicCommand } from "@/lib/server/roomCommands";
import type { TopicType } from "@/lib/topics";
import { traceError } from "@/lib/utils/trace";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(1),
  action: z.enum(["select", "shuffle", "custom", "reset"]),
  type: z.string().optional().nullable(),
  text: z.string().optional().nullable(),
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

  const action = parsed.data.action;
  const typeValue = typeof parsed.data.type === "string" ? (parsed.data.type as TopicType) : null;
  const text = typeof parsed.data.text === "string" ? parsed.data.text : "";

  try {
    if (action === "reset") {
      await topicCommand({ roomId, token: parsed.data.token, action: { kind: "reset" } });
    } else if (action === "custom") {
      await topicCommand({ roomId, token: parsed.data.token, action: { kind: "custom", text } });
    } else if (action === "select") {
      const topicType = (typeValue ?? "") as TopicType;
      await topicCommand({ roomId, token: parsed.data.token, action: { kind: "select", type: topicType } });
    } else {
      await topicCommand({ roomId, token: parsed.data.token, action: { kind: "shuffle", type: typeValue ?? null } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    traceError("room.topic.api", error, { roomId, action });
    const code = (error as { code?: string }).code;
    const status =
      code === "unauthorized"
        ? 401
        : code === "room_not_found"
          ? 404
          : code === "forbidden"
            ? 403
            : code === "invalid_status"
              ? 409
              : 500;
    return NextResponse.json({ error: code ?? "internal_error" }, { status });
  }
}
