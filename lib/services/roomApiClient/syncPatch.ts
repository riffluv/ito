import { setMetric } from "@/lib/utils/metrics";
import { parseRoomSyncPatch, type RoomSyncPatch } from "@/lib/sync/roomSyncPatch";

export { type RoomSyncPatch };

export function dispatchRoomSyncPatch(value: unknown): RoomSyncPatch | null {
  if (typeof window === "undefined") return null;
  const patch = parseRoomSyncPatch(value);
  if (!patch) return null;
  try {
    window.dispatchEvent(
      new CustomEvent("ito:room-sync-patch", { detail: patch })
    );
  } catch {
    // ignore
  }
  try {
    setMetric(
      "api",
      "lastSyncPatch",
      `${patch.meta.source}:${patch.statusVersion}@${patch.roomId}`
    );
  } catch {
    // ignore
  }
  return patch;
}

