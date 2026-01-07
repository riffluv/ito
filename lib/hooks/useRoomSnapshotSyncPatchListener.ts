"use client";

import { applyRoomSyncPatch } from "@/lib/sync/applyRoomSyncPatch";
import { parseRoomSyncPatch } from "@/lib/sync/roomSyncPatch";
import { storePrefetchedRoom } from "@/lib/prefetch/prefetchRoomExperience";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";
import type { RoomDoc } from "@/lib/types";
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

export function useRoomSnapshotSyncPatchListener(params: {
  roomId: string;
  leavingRef: MutableRefObject<boolean>;
  roomStateRef: MutableRefObject<(RoomDoc & { id: string }) | null>;
  statusVersionRef: MutableRefObject<number>;
  setRoom: Dispatch<SetStateAction<(RoomDoc & { id: string }) | null>>;
  enqueueCommit: (task: () => void, startedAt: number | null, metricKey?: string) => void;
}) {
  const { roomId, leavingRef, roomStateRef, statusVersionRef, setRoom, enqueueCommit } = params;

  // Apply sync patches (API/RTDB) without waiting for Firestore propagation.
  useEffect(() => {
    if (typeof window === "undefined") return () => undefined;
    if (!roomId) return () => undefined;

    const handler = (event: Event) => {
      if (leavingRef.current) return;
      const patch = parseRoomSyncPatch((event as CustomEvent).detail);
      if (!patch || patch.roomId !== roomId) return;

      const startedAt = typeof performance !== "undefined" ? performance.now() : null;
      const result = applyRoomSyncPatch(roomStateRef.current, patch);
      enqueueCommit(() => {
        if (!result.applied) {
          setMetric(
            "roomSnapshot",
            "patch.lastIgnored",
            `${result.reason}@${patch.meta.source}:${patch.statusVersion}`
          );
          return;
        }

        statusVersionRef.current = patch.statusVersion;
        roomStateRef.current = result.next;
        setRoom(result.next);

        setMetric("roomSnapshot", "patch.lastSource", patch.meta.source);
        setMetric("roomSnapshot", "patch.lastStatusVersion", patch.statusVersion);
        if (typeof patch.meta.ts === "number" && Number.isFinite(patch.meta.ts)) {
          setMetric("roomSnapshot", "patch.lastTs", patch.meta.ts);
        }
        if (typeof patch.meta.requestId === "string" && patch.meta.requestId.trim().length > 0) {
          setMetric("roomSnapshot", "patch.lastRequestId", patch.meta.requestId);
        }
        try {
          traceAction("room.sync.patch.apply", {
            source: patch.meta.source,
            roomId,
            statusVersion: String(patch.statusVersion),
            status: patch.room.status ?? undefined,
            command: patch.meta.command ?? undefined,
            requestId: patch.meta.requestId ?? undefined,
          });
        } catch {}
        try {
          const { id: _ignored, ...toStore } = result.next;
          storePrefetchedRoom(roomId, toStore as unknown as Record<string, unknown>);
        } catch {}
      }, startedAt, "syncPatchCommitMs");
    };

    window.addEventListener("ito:room-sync-patch", handler as EventListener);
    return () => {
      window.removeEventListener("ito:room-sync-patch", handler as EventListener);
    };
  }, [enqueueCommit, leavingRef, roomId, roomStateRef, setRoom, statusVersionRef]);
}

