import { doc, getDoc, getDocFromServer, type Firestore } from "firebase/firestore";

import { notify } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { traceAction, traceError } from "@/lib/utils/trace";

export function scheduleQuickStartSyncWatchdogs(params: {
  roomId: string;
  requestId: string;
  db?: Firestore | null;
  latestRoomStatusRef: { current: string | null | undefined };
  quickStartEarlySyncTimerRef: { current: number | null };
  quickStartStuckTimerRef: { current: number | null };
}): void {
  const {
    roomId,
    requestId,
    db,
    latestRoomStatusRef,
    quickStartEarlySyncTimerRef,
    quickStartStuckTimerRef,
  } = params;

  if (typeof window === "undefined") {
    return;
  }

  if (quickStartEarlySyncTimerRef.current !== null) {
    window.clearTimeout(quickStartEarlySyncTimerRef.current);
  }
  quickStartEarlySyncTimerRef.current = window.setTimeout(() => {
    try {
      if (latestRoomStatusRef.current === "clue") {
        return;
      }
      window.dispatchEvent(
        new CustomEvent("ito:room-force-refresh", {
          detail: {
            roomId,
            reason: `host.quickStart.earlySync:${requestId}`,
          },
        })
      );
    } catch {}
  }, 520);

  if (quickStartStuckTimerRef.current !== null) {
    window.clearTimeout(quickStartStuckTimerRef.current);
  }
  quickStartStuckTimerRef.current = window.setTimeout(() => {
    void (async () => {
      try {
        if (latestRoomStatusRef.current === "clue") {
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
        if (serverStatus === "clue" && localStatus !== "clue") {
          traceAction("ui.host.quickStart.stuck", {
            roomId,
            requestId,
            localStatus,
            serverStatus,
          });
          try {
            window.dispatchEvent(
              new CustomEvent("ito:room-force-refresh", {
                detail: {
                  roomId,
                  reason: `host.quickStart.stuck:${requestId}`,
                },
              })
            );
          } catch {}
          try {
            window.dispatchEvent(
              new CustomEvent("ito:room-restart-listener", {
                detail: {
                  roomId,
                  reason: `host.quickStart.stuck:${requestId}`,
                },
              })
            );
          } catch {}
          notify({
            id: toastIds.genericInfo(roomId, "quickstart-stuck"),
            title: "ゲームは開始されています",
            description:
              `画面の同期が遅れています。ルーム情報を再取得します。` +
              `改善しない場合はページを再読み込みしてください。（server:${serverStatus}）`,
            type: "warning",
            duration: 4200,
          });
        } else {
          traceAction("ui.host.quickStart.stuck", {
            roomId,
            requestId,
            localStatus,
            serverStatus: serverStatus ?? "unknown",
          });
        }
      } catch (error) {
        traceError("ui.host.quickStart.stuckRead", error, {
          roomId,
          requestId,
        });
      }
    })();
  }, 3200);
}

