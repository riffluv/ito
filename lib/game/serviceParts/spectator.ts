import { db } from "@/lib/firebase/client";
import { withPermissionRetry } from "@/lib/firebase/permissionGuard";
import { spectatorV2Service } from "@/lib/spectator/v2/service";
import { bumpMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { collection, getDocs, query, where } from "firebase/firestore";

export async function cancelSeatRequest(roomId: string, uid: string) {
  traceAction("spectator.cancelSeatRequest", { roomId, uid });
  const run = async () => {
    if (!db) {
      throw new Error("firebase-unavailable");
    }
    const sessionQuery = query(
      collection(db, "spectatorSessions"),
      where("roomId", "==", roomId),
      where("viewerUid", "==", uid)
    );
    const snapshot = await getDocs(sessionQuery);
    if (snapshot.empty) {
      return;
    }
    let cancelled = false;
    const tasks: Promise<void>[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const rejoin = data.rejoinRequest as Record<string, unknown> | undefined;
      if (!rejoin || rejoin.status !== "pending") {
        return;
      }
      tasks.push(
        spectatorV2Service.cancelRejoin({ sessionId: docSnap.id, roomId }).then(() => {
          cancelled = true;
        })
      );
    });
    await Promise.all(tasks);
    if (cancelled) {
      bumpMetric("recall", "cancelled");
    }
  };
  try {
    await withPermissionRetry(run, {
      context: "spectator.cancelSeatRequest",
      toastContext: "観戦リクエスト",
    });
  } catch (error) {
    traceError("spectator.cancelSeatRequest", error, { roomId, uid });
    throw error;
  }
}

