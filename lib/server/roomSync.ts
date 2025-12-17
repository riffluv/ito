import { getAdminRtdb } from "@/lib/server/firebaseAdmin";
import { traceAction, traceError } from "@/lib/utils/trace";
import type { RoomSyncPatch, RoomSyncPatchCommand, RoomSyncPatchRoom } from "@/lib/sync/roomSyncPatch";

export function buildRoomSyncPatch(params: {
  roomId: string;
  statusVersion: number;
  room: RoomSyncPatchRoom;
  command: RoomSyncPatchCommand;
  requestId?: string | null;
  source: RoomSyncPatch["meta"]["source"];
  ts?: number;
}): RoomSyncPatch {
  const ts = typeof params.ts === "number" && Number.isFinite(params.ts) ? params.ts : Date.now();
  return {
    roomId: params.roomId,
    statusVersion: params.statusVersion,
    room: params.room,
    meta: {
      source: params.source,
      command: params.command,
      requestId: params.requestId ?? null,
      ts,
    },
  };
}

export async function publishRoomSyncPatch(patch: RoomSyncPatch): Promise<boolean> {
  const rtdb = getAdminRtdb();
  if (!rtdb) return false;
  try {
    await rtdb.ref(`roomSync/${patch.roomId}/latest`).set(patch);
    traceAction("room.sync.event.publish", {
      roomId: patch.roomId,
      statusVersion: String(patch.statusVersion),
      command: patch.meta.command ?? "unknown",
      source: patch.meta.source,
    });
    return true;
  } catch (error) {
    traceError("room.sync.event.publish", error, {
      roomId: patch.roomId,
      statusVersion: String(patch.statusVersion),
      command: patch.meta.command ?? "unknown",
      source: patch.meta.source,
    });
    return false;
  }
}

