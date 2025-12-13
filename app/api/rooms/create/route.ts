import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { versionsEqual, normalizeVersion } from "@/lib/server/roomVersionGate";
import { createRoom } from "@/lib/server/roomCommands";
import { traceError } from "@/lib/utils/trace";
import type { RoomDoc } from "@/lib/types";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(1),
  roomName: z.string().min(1),
  displayName: z.string().min(1),
  displayMode: z.string().optional().nullable(),
  options: z.record(z.any()).optional(),
  passwordHash: z.string().optional().nullable(),
  passwordSalt: z.string().optional().nullable(),
  passwordVersion: z.number().optional().nullable(),
  clientVersion: z.string().optional().nullable(),
});

type ErrorBody = {
  error: string;
  message?: string;
  roomVersion?: string | null;
  clientVersion?: string | null;
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" } satisfies ErrorBody, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" } satisfies ErrorBody, { status: 400 });
  }

  const clientVersion = normalizeVersion(parsed.data.clientVersion) ?? null;
  const serverVersion = normalizeVersion(APP_VERSION);
  if (!clientVersion) {
    return NextResponse.json(
      {
        error: "client_version_required",
        roomVersion: serverVersion ?? null,
        clientVersion: null,
      } satisfies ErrorBody,
      { status: 400 }
    );
  }
  if (clientVersion && serverVersion && !versionsEqual(clientVersion, serverVersion)) {
    const payload: ErrorBody = {
      error: "room/create/version-mismatch",
      roomVersion: serverVersion,
      clientVersion,
    };
    return NextResponse.json(payload, { status: 409 });
  }

  try {
    const result = await createRoom({
      token: parsed.data.token,
      roomName: parsed.data.roomName,
      displayName: parsed.data.displayName,
      displayMode: parsed.data.displayMode,
      options: parsed.data.options as unknown as RoomDoc["options"] | undefined,
      passwordHash: parsed.data.passwordHash ?? null,
      passwordSalt: parsed.data.passwordSalt ?? null,
      passwordVersion: parsed.data.passwordVersion ?? null,
    });
    return NextResponse.json({
      ok: true,
      roomId: result.roomId,
      appVersion: result.appVersion,
    });
  } catch (error) {
    traceError("room.create.api", error);
    const code = (error as { code?: string }).code;
    const status = code === "unauthorized" ? 401 : 500;
    const payload: ErrorBody = {
      error: code ?? "internal_error",
      message: (error as Error | undefined)?.message,
    };
    return NextResponse.json(payload, { status });
  }
}
