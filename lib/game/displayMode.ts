import type { RoomDoc } from "@/lib/types";

export type DisplayMode = "full" | "minimal";

export const MINIMAL_TAG = "[自分の手札]";

export function hasMinimalTag(name: string | null | undefined): boolean {
  if (!name) return false;
  return /\s*\[自分の手札\]$/.test(String(name).trim());
}

export function stripMinimalTag(name: string | null | undefined): string {
  if (!name) return "";
  return String(name).replace(/\s*\[自分の手札\]$/, "");
}

export function applyDisplayModeToName(
  baseName: string,
  mode: DisplayMode
): string {
  const clean = stripMinimalTag(baseName);
  if (mode === "minimal") return `${clean} ${MINIMAL_TAG}`.trim();
  return clean;
}

type RoomDisplayOptions = RoomDoc["options"] & { displayMode?: DisplayMode };

export function getDisplayMode(room: Partial<RoomDoc> | null | undefined): DisplayMode {
  const opts = room?.options as RoomDisplayOptions | undefined;
  const v = opts?.displayMode;
  if (v === "minimal" || v === "full") return v;
  return hasMinimalTag(room?.name) ? "minimal" : "full";
}
