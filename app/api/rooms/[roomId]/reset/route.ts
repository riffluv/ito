import { logError } from "@/lib/utils/log";
import { NextRequest, NextResponse } from "next/server";
import { resetRoomCommand } from "@/lib/server/roomCommands";

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
  const recallSpectators =
    typeof body?.recallSpectators === "boolean"
      ? (body.recallSpectators as boolean)
      : true;
  const requestId =
    typeof body?.requestId === "string" && (body.requestId as string).length > 0
      ? (body.requestId as string)
      : undefined;

  if (!token) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  try {
    await resetRoomCommand({ roomId, recallSpectators, token, requestId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logError("rooms", "reset-route error", { roomId, error });
    const code = (error as { code?: string }).code;
    const status =
      code === "unauthorized"
        ? 401
        : code === "room_not_found"
          ? 404
          : code === "forbidden"
            ? 403
            : 500;
    return NextResponse.json({ error: code ?? "reset_failed" }, { status });
  }
}
