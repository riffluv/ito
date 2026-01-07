"use client";

import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { parseRoomSyncPatch } from "@/lib/sync/roomSyncPatch";
import { rtdb } from "@/lib/firebase/client";
import {
  off as offRtdb,
  onValue,
  ref as rtdbRef,
  type DataSnapshot,
} from "firebase/database";
import { useEffect, type MutableRefObject } from "react";

export function useRoomSnapshotRtdbRoomSyncBus(params: {
  roomId: string;
  leavingRef: MutableRefObject<boolean>;
  lastServerStatusVersionRef: MutableRefObject<number>;
  rtdbLastEventVersionRef: MutableRefObject<number>;
  rtdbLastEventKeyRef: MutableRefObject<string>;
  rtdbConfirmTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  rtdbPendingConfirmVersionRef: MutableRefObject<number>;
}) {
  const {
    roomId,
    leavingRef,
    lastServerStatusVersionRef,
    rtdbLastEventVersionRef,
    rtdbLastEventKeyRef,
    rtdbConfirmTimerRef,
    rtdbPendingConfirmVersionRef,
  } = params;

  useEffect(() => {
    if (typeof window === "undefined") return () => undefined;
    if (!roomId || !rtdb) return () => undefined;

    const ref = rtdbRef(rtdb, `roomSync/${roomId}/latest`);
    const handler = (snap: DataSnapshot) => {
      if (leavingRef.current) return;
      const patch = parseRoomSyncPatch(snap.val());
      if (!patch || patch.roomId !== roomId) return;

      const key = `${patch.statusVersion}:${patch.meta.ts ?? 0}:${patch.meta.requestId ?? ""}:${patch.meta.command ?? ""}`;
      if (key === rtdbLastEventKeyRef.current) return;
      rtdbLastEventKeyRef.current = key;
      rtdbLastEventVersionRef.current = patch.statusVersion;

      setMetric("roomSnapshot", "rtdb.lastEventTs", Date.now());
      setMetric("roomSnapshot", "rtdb.lastStatusVersion", patch.statusVersion);
      if (typeof patch.meta.ts === "number" && Number.isFinite(patch.meta.ts)) {
        setMetric("roomSnapshot", "rtdb.lastEventServerTs", patch.meta.ts);
      }

      try {
        traceAction("room.sync.event.received", {
          source: "rtdb",
          roomId,
          statusVersion: String(patch.statusVersion),
          command: patch.meta.command ?? undefined,
          requestId: patch.meta.requestId ?? undefined,
        });
      } catch {}

      try {
        window.dispatchEvent(new CustomEvent("ito:room-sync-patch", { detail: patch }));
      } catch {}

      const serverVersion = lastServerStatusVersionRef.current;
      if (patch.statusVersion <= serverVersion) {
        return;
      }

      rtdbPendingConfirmVersionRef.current = patch.statusVersion;
      if (rtdbConfirmTimerRef.current !== null) {
        clearTimeout(rtdbConfirmTimerRef.current);
        rtdbConfirmTimerRef.current = null;
      }
      rtdbConfirmTimerRef.current = setTimeout(() => {
        rtdbConfirmTimerRef.current = null;
        const pending = rtdbPendingConfirmVersionRef.current;
        if (pending !== patch.statusVersion) return;
        const confirmed = lastServerStatusVersionRef.current;
        if (confirmed >= patch.statusVersion) return;

        try {
          traceAction("room.sync.rtdb.unconfirmed.forceRefresh", {
            roomId,
            statusVersion: String(patch.statusVersion),
            confirmedVersion: String(confirmed),
          });
        } catch {}
        try {
          window.dispatchEvent(
            new CustomEvent("ito:room-force-refresh", {
              detail: {
                roomId,
                reason: `room.sync.rtdb.unconfirmed:${patch.statusVersion}`,
              },
            })
          );
        } catch {}
        try {
          window.dispatchEvent(
            new CustomEvent("ito:room-restart-listener", {
              detail: {
                roomId,
                reason: `room.sync.rtdb.unconfirmed:${patch.statusVersion}`,
              },
            })
          );
        } catch {}
      }, 1500);
    };
    const onErr = (error: Error) => {
      setMetric("roomSnapshot", "rtdb.lastListenErrorTs", Date.now());
      traceError("room.sync.event.listen", error, { roomId });
    };

    onValue(ref, handler, onErr);
    return () => {
      try {
        offRtdb(ref, "value", handler);
      } catch {}
      if (rtdbConfirmTimerRef.current !== null) {
        clearTimeout(rtdbConfirmTimerRef.current);
        rtdbConfirmTimerRef.current = null;
      }
    };
  }, [
    lastServerStatusVersionRef,
    leavingRef,
    roomId,
    rtdbConfirmTimerRef,
    rtdbLastEventKeyRef,
    rtdbLastEventVersionRef,
    rtdbPendingConfirmVersionRef,
  ]);
}

