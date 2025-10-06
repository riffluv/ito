import fs from "node:fs";
import path from "node:path";
import { buildCandidateUrls } from "./paths";

export const resolveExistingPublicAsset = (candidate: string): string | null => {
  const relative = candidate.replace(/^\//, "");
  const fullPath = path.join(process.cwd(), "public", relative);
  return fs.existsSync(fullPath) ? candidate : null;
};

export const resolvePreferredVariantUrl = (src: string): string | null => {
  for (const candidate of buildCandidateUrls(src)) {
    const existing = resolveExistingPublicAsset(candidate);
    if (existing) {
      return existing;
    }
  }
  return null;
};
