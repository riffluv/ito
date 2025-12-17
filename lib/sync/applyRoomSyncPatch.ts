import type { RoomDoc } from "@/lib/types";
import type { RoomSyncPatch } from "@/lib/sync/roomSyncPatch";

export type RoomSyncPatchIgnoredReason =
  | "no-room"
  | "room-mismatch"
  | "stale"
  | "duplicate";

export type RoomSyncPatchApplyResult =
  | { applied: true; next: RoomDoc & { id: string } }
  | { applied: false; reason: RoomSyncPatchIgnoredReason; next: RoomDoc & { id: string } | null };

const readStatusVersion = (room: (RoomDoc & { id: string }) | null): number =>
  typeof room?.statusVersion === "number" && Number.isFinite(room.statusVersion) ? room.statusVersion : 0;

export function applyRoomSyncPatch(
  current: (RoomDoc & { id: string }) | null,
  patch: RoomSyncPatch
): RoomSyncPatchApplyResult {
  if (!current) {
    return { applied: false, reason: "no-room", next: current };
  }
  if (current.id !== patch.roomId) {
    return { applied: false, reason: "room-mismatch", next: current };
  }

  const currentVersion = readStatusVersion(current);
  const incomingVersion = patch.statusVersion;
  if (incomingVersion < currentVersion) {
    return { applied: false, reason: "stale", next: current };
  }
  if (incomingVersion === currentVersion) {
    return { applied: false, reason: "duplicate", next: current };
  }

  const roomPatch = patch.room ?? {};
  let nextUi: RoomDoc["ui"] | undefined = current.ui;
  if (roomPatch.ui && typeof roomPatch.ui === "object") {
    nextUi = { ...(current.ui ?? {}) };
    if (typeof roomPatch.ui.roundPreparing === "boolean") {
      nextUi.roundPreparing = roomPatch.ui.roundPreparing;
    }
    if (typeof roomPatch.ui.recallOpen === "boolean") {
      nextUi.recallOpen = roomPatch.ui.recallOpen;
    }
    if (typeof roomPatch.ui.revealPending === "boolean") {
      nextUi.revealPending = roomPatch.ui.revealPending;
    }
  }

  const next: RoomDoc & { id: string } = {
    ...current,
    ...(roomPatch.status !== undefined ? { status: roomPatch.status } : {}),
    ...(roomPatch.topic !== undefined ? { topic: roomPatch.topic } : {}),
    ...(roomPatch.topicBox !== undefined ? { topicBox: roomPatch.topicBox } : {}),
    ...(roomPatch.round !== undefined ? { round: roomPatch.round ?? undefined } : {}),
    ...(roomPatch.ui ? { ui: nextUi } : {}),
    statusVersion: incomingVersion,
  };

  return { applied: true, next };
}
