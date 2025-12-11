import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkRoomVersionGuard } from "@/lib/server/roomVersionGate";
import { startGameCommand } from "@/lib/server/roomCommands";
import { traceError } from "@/lib/utils/trace";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(1),
  clientVersion: z.string().optional().nullable(),
  // 「次のゲーム」ボタンなど reveal/finished 状態からの開始を許可するフラグ
  allowFromFinished: z.boolean().optional().nullable(),
  // リトライ時のレース条件対策: clue 状態からも開始可能にするフラグ
  allowFromClue: z.boolean().optional().nullable(),
  requestId: z.string().min(4).max(64).optional().nullable(),
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
    await startGameCommand({
      roomId,
      token: parsed.data.token,
      allowFromFinished: parsed.data.allowFromFinished ?? false,
      allowFromClue: parsed.data.allowFromClue ?? false,
      requestId: parsed.data.requestId ?? undefined,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    traceError("room.start.api", error, { roomId });
    const code = (error as { code?: string }).code;
    const status =
      code === "unauthorized" ? 401 : code === "forbidden" ? 403 : code === "invalid_status" ? 409 : 500;
    return NextResponse.json({ error: code ?? "internal_error" }, { status });
  }
}
