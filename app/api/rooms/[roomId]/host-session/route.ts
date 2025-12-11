import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { issueHostSession } from "@/lib/server/hostToken";
import { traceError } from "@/lib/utils/trace";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(1),
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
  try {
    const session = await issueHostSession(roomId, parsed.data.token);
    return NextResponse.json({ ok: true, sessionId: session.sessionId, expiresAt: session.expiresAt });
  } catch (error) {
    traceError("hostSession.issue", error, { roomId });
    return NextResponse.json({ error: "issue_failed" }, { status: 500 });
  }
}
