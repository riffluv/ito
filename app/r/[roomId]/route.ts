import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: { roomId: string } }) {
  const roomId = params?.roomId?.trim();
  if (!roomId) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const targetUrl = new URL(`/rooms/${encodeURIComponent(roomId)}`, request.url);
  return NextResponse.redirect(targetUrl);
}