import { doc, getDoc, getDocFromServer, type Firestore } from "firebase/firestore";

import { notify } from "@/components/ui/notify";
import { clearTimerRef } from "@/lib/hooks/hostActions/timers";
import { toastIds } from "@/lib/ui/toastIds";
import { traceAction, traceError } from "@/lib/utils/trace";

export function scheduleNextGameSyncWatchdogs(params: {
  roomId: string;
  requestId: string;
  db?: Firestore | null;
  latestRoomStatusRef: { current: string | null | undefined };
  nextGameEarlySyncTimerRef: { current: number | null };
  nextGameStuckTimerRef: { current: number | null };
}): void {
  const {
    roomId,
    requestId,
    db,
    latestRoomStatusRef,
    nextGameEarlySyncTimerRef,
    nextGameStuckTimerRef,
  } = params;

  if (typeof window === "undefined") {
    return;
  }

  clearTimerRef(nextGameEarlySyncTimerRef);
  nextGameEarlySyncTimerRef.current = window.setTimeout(() => {
    try {
      if (latestRoomStatusRef.current === "clue") {
        return;
      }
      window.dispatchEvent(
        new CustomEvent("ito:room-force-refresh", {
          detail: {
            roomId,
            reason: `host.nextGame.earlySync:${requestId}`,
          },
        })
      );
    } catch {}
  }, 520);

  clearTimerRef(nextGameStuckTimerRef);
  nextGameStuckTimerRef.current = window.setTimeout(() => {
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
        if (serverStatus === "clue" && latestRoomStatusRef.current !== "clue") {
          traceAction("ui.host.nextGame.stuck", {
            roomId,
            requestId,
            localStatus: latestRoomStatusRef.current ?? "unknown",
            serverStatus,
          });
          try {
            window.dispatchEvent(
              new CustomEvent("ito:room-force-refresh", {
                detail: {
                  roomId,
                  reason: `host.nextGame.stuck:${requestId}`,
                },
              })
            );
          } catch {}
          notify({
            id: toastIds.genericInfo(roomId, "nextgame-stuck"),
            title: "次のラウンドは開始されています",
            description: "画面の同期が遅れています。ルーム情報を再取得します。改善しない場合はページを再読み込みしてください。",
            type: "warning",
            duration: 4200,
          });
        } else if (serverStatus) {
          traceAction("ui.host.nextGame.stuck", {
            roomId,
            requestId,
            localStatus: latestRoomStatusRef.current ?? "unknown",
            serverStatus,
          });
        }
      } catch (error) {
        traceError("ui.host.nextGame.stuckRead", error, {
          roomId,
          requestId,
        });
      }
    })();
  }, 3200);
}
