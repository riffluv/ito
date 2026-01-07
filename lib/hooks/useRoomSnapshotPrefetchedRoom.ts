"use client";

import { loadPrefetchedRoom } from "@/lib/prefetch/prefetchRoomExperience";
import type { RoomDoc } from "@/lib/types";
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

export function useRoomSnapshotPrefetchedRoom(params: {
  roomId: string;
  currentRoomId: string | null;
  prefetchedAppliedRef: MutableRefObject<boolean>;
  enqueueCommit: (task: () => void, startedAt: number | null, metricKey?: string) => void;
  setRoom: Dispatch<SetStateAction<(RoomDoc & { id: string }) | null>>;
  setRoomLoaded: Dispatch<SetStateAction<boolean>>;
}) {
  const {
    roomId,
    currentRoomId,
    prefetchedAppliedRef,
    enqueueCommit,
    setRoom,
    setRoomLoaded,
  } = params;

  // Apply prefetched room
  useEffect(() => {
    if (!roomId || typeof window === "undefined") {
      prefetchedAppliedRef.current = false;
      return;
    }
    const cached = loadPrefetchedRoom(roomId);
    if (!cached) {
      prefetchedAppliedRef.current = false;
      return;
    }
    if (currentRoomId === roomId) {
      return;
    }
    prefetchedAppliedRef.current = true;
    const startedAt = typeof performance !== "undefined" ? performance.now() : null;
    enqueueCommit(() => {
      prefetchedAppliedRef.current = true;
      setRoom({ id: roomId, ...(cached as RoomDoc) });
      setRoomLoaded(true);
    }, startedAt);
  }, [
    currentRoomId,
    enqueueCommit,
    prefetchedAppliedRef,
    roomId,
    setRoom,
    setRoomLoaded,
  ]);
}

