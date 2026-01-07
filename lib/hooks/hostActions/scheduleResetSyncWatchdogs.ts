import { doc, getDoc, getDocFromServer, type Firestore } from "firebase/firestore";

import { notify } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { traceAction, traceError } from "@/lib/utils/trace";

export function scheduleResetSyncWatchdogs(params: {
  roomId: string;
  db?: Firestore | null;
  latestRoomStatusRef: { current: string | null | undefined };
  resetEarlySyncTimerRef: { current: number | null };
  resetStuckTimerRef: { current: number | null };
}): void {
  const { roomId, db, latestRoomStatusRef, resetEarlySyncTimerRef, resetStuckTimerRef } = params;

  if (typeof window === "undefined") {
    return;
  }

  if (resetEarlySyncTimerRef.current !== null) {
    window.clearTimeout(resetEarlySyncTimerRef.current);
  }
  resetEarlySyncTimerRef.current = window.setTimeout(() => {
    try {
      if (latestRoomStatusRef.current === "waiting") {
        return;
      }
      window.dispatchEvent(
        new CustomEvent("ito:room-force-refresh", {
          detail: {
            roomId,
            reason: "host.reset.earlySync",
          },
        })
      );
    } catch {}
  }, 520);

  if (resetStuckTimerRef.current !== null) {
    window.clearTimeout(resetStuckTimerRef.current);
  }
  resetStuckTimerRef.current = window.setTimeout(() => {
    void (async () => {
      try {
        if (latestRoomStatusRef.current === "waiting") {
          return;
        }
        if (!db) {
          return;
        }
        const ref = doc(db, "rooms", roomId);
        const snap = await getDocFromServer(ref).catch(() => getDoc(ref));
        const data = snap.data() as { status?: unknown } | undefined;
        const serverStatus = typeof data?.status === "string" ? data.status : null;
        const localStatus = latestRoomStatusRef.current ?? "unknown";
        if (serverStatus === "waiting" && localStatus !== "waiting") {
          traceAction("ui.room.reset.stuck", {
            roomId,
            localStatus,
            serverStatus,
          });
          try {
            window.dispatchEvent(
              new CustomEvent("ito:room-force-refresh", {
                detail: {
                  roomId,
                  reason: "host.reset.stuck",
                },
              })
            );
          } catch {}
          try {
            window.dispatchEvent(
              new CustomEvent("ito:room-restart-listener", {
                detail: {
                  roomId,
                  reason: "host.reset.stuck",
                },
              })
            );
          } catch {}
          notify({
            id: toastIds.genericInfo(roomId, "reset-stuck"),
            title: "画面の同期が遅れています",
            description: "最新の状態を取得します。改善しない場合はページを再読み込みしてください。",
            type: "warning",
            duration: 4200,
          });
        } else if (serverStatus) {
          traceAction("ui.room.reset.stuck", {
            roomId,
            localStatus,
            serverStatus,
          });
        }
      } catch (error) {
        traceError("ui.room.reset.stuckRead", error, { roomId });
      }
    })();
  }, 3200);
}

