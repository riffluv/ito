#!/usr/bin/env node
/**
 * Build-time guard: fail if critical API route bundles are missing.
 * This catches accidental static export / misconfigured Vercel output that strips /api/*.
 */
const fs = require("node:fs");
const path = require("node:path");

// For each logical API endpoint, allow multiple concrete build locations.
// - create: can be implemented either as an App Router Route Handler
//           (app/api/rooms/create/route.*) or a Pages API Route
//           (pages/api/rooms/create.*)
// - join / deal: must remain App Router routes
const routeCandidates = [
  {
    label: "rooms/create",
    candidates: [
      // App Router route handler
      (ext) => path.join(".next", "server", "app", "api", "rooms", "create", `route${ext}`),
      // Pages API route
      (ext) => path.join(".next", "server", "pages", "api", "rooms", `create${ext}`),
    ],
  },
  {
    label: "rooms/[roomId]/join",
    candidates: [
      (ext) => path.join(".next", "server", "app", "api", "rooms", "[roomId]", "join", `route${ext}`),
    ],
  },
  {
    label: "rooms/[roomId]/deal",
    candidates: [
      (ext) => path.join(".next", "server", "app", "api", "rooms", "[roomId]", "deal", `route${ext}`),
    ],
  },
];

const exts = [".js", ".mjs", ".cjs"];

const missing = [];

for (const route of routeCandidates) {
  const found = route.candidates.some((buildPathFactory) =>
    exts.some((ext) => fs.existsSync(buildPathFactory(ext)))
  );
  if (!found) {
    missing.push(route.label);
  }
}

if (missing.length > 0) {
  console.error("[verify-api-routes] Missing route bundles:");
  for (const r of missing) {
    console.error(` - ${r} (expected .next/server/${r}/route.{js,mjs,cjs})`);
  }
  console.error(
    "Next.js build skipped API routes. Check Vercel config: Build Command must be `npm run build`, Output Directory must be empty, and output/export must stay disabled."
  );
  process.exit(1);
}

console.log("[verify-api-routes] OK: required API route bundles found.");
