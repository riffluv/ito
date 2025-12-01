import { NextResponse } from "next/server";

// Always serve fresh content so the SW update algorithm sees the new body
// on each deployment (even when clients stay on an old page).
export const dynamic = "force-dynamic";
export const revalidate = 0;

const resolveSwMetaVersion = () =>
  process.env.NEXT_PUBLIC_SW_VERSION ||
  process.env.NEXT_BUILD_ID ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  "dev";

export function GET() {
  const version = resolveSwMetaVersion();
  const body = `self.__SW_META_VERSION__ = "${version}";`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, must-revalidate",
      "X-SW-META-VERSION": version,
    },
  });
}
