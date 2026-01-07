"use client";

import { useMemo, type MutableRefObject } from "react";

export type RoomSnapshotExternalControls = {
  detachNow: () => void;
  reattachPresence: () => void;
  leavingRef: MutableRefObject<boolean>;
};

export function useRoomSnapshotExternalControls(params: {
  detachNow: () => void;
  reattachPresence: () => void;
  leavingRef: MutableRefObject<boolean>;
}): RoomSnapshotExternalControls {
  const { detachNow, reattachPresence, leavingRef } = params;

  return useMemo(
    () => ({
      detachNow,
      reattachPresence,
      leavingRef,
    }),
    [detachNow, leavingRef, reattachPresence]
  );
}

