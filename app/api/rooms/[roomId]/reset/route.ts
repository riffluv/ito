import { NextRequest, NextResponse } from "next/server";
import { checkRoomVersionGuard } from "@/lib/server/roomVersionGate";
import { resetRoomCommand } from "@/lib/server/roomCommands";
import { traceError } from "@/lib/utils/trace";

export const runtime = "nodejs";

type ResetRouteOverrides = {
  guard?: typeof checkRoomVersionGuard;
  resetCommand?: typeof resetRoomCommand;
};

let overrides: ResetRouteOverrides | null = null;

declare global {
  // eslint-disable-next-line no-var
  var __setResetRouteOverrides: ((value: ResetRouteOverrides | null) => void) | undefined;
}

globalThis.__setResetRouteOverrides = (value) => {
  if (process.env.NODE_ENV !== "test") return;
  overrides = value;
};

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
  const clientVersion =
    typeof body?.clientVersion === "string" ? (body.clientVersion as string) : null;
  const recallSpectators =
    typeof body?.recallSpectators === "boolean"
      ? (body.recallSpectators as boolean)
      : true;
  const sessionId =
    typeof body?.sessionId === "string" && (body.sessionId as string).length >= 8
      ? (body.sessionId as string)
      : undefined;
  const requestId =
    typeof body?.requestId === "string" && (body.requestId as string).length >= 8
      ? (body.requestId as string)
      : null;

  if (!token) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const guard = await (overrides?.guard ?? checkRoomVersionGuard)(roomId, clientVersion);
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
    const sync = await (overrides?.resetCommand ?? resetRoomCommand)({
      roomId,
      recallSpectators,
      token,
      requestId,
      sessionId,
    });
    return NextResponse.json({ ok: true, sync });
  } catch (error) {
    traceError("room.reset.api", error, { roomId });
    const code = (error as { code?: string }).code;
    const reason = (error as { reason?: string }).reason;
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
    return NextResponse.json({ error: code ?? "reset_failed", reason }, { status });
  }
}
