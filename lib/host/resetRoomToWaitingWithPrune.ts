import type { ApiError } from "@/lib/services/roomApiClient";
import type { RoomDoc } from "@/lib/types";
import { APP_VERSION } from "@/lib/constants/appVersion";
import { resetRoomWithPrune } from "@/lib/game/service";
import {
  generateRequestId,
  getErrorMessage,
  isTransientNetworkError,
  sleep,
} from "@/lib/host/hostActionsControllerHelpers";
import { postRoundReset } from "@/lib/utils/broadcast";
import { traceAction } from "@/lib/utils/trace";
import { getAuth } from "firebase/auth";

export type ResetRoomRequest = {
  roomId: string;
  roundIds?: string[] | null;
  onlineUids?: (string | null | undefined)[] | null;
  includeOnline?: boolean;
  recallSpectators?: boolean;
};

export type ResetRoomResult = {
  ok: true;
  keptCount: number;
  pruneTargets: number;
};

type ResetRoomDeps = {
  resolveSessionId: () => Promise<string | null>;
  fetchRoomSnapshot: (roomId: string) => Promise<RoomDoc | null>;
  resetRoomWithPruneImpl?: typeof resetRoomWithPrune;
};

export function createResetRoomToWaitingWithPrune(deps: ResetRoomDeps) {
  const resolveSessionId = deps.resolveSessionId;
  const fetchRoomSnapshot = deps.fetchRoomSnapshot;
  const resetRoomWithPruneImpl = deps.resetRoomWithPruneImpl ?? resetRoomWithPrune;

  return async (req: ResetRoomRequest): Promise<ResetRoomResult> => {
    const resetRequestId = generateRequestId();
    const keepSet = new Set<string>();
    if (Array.isArray(req.roundIds)) {
      req.roundIds.forEach((id) => {
        if (typeof id === "string" && id.trim()) keepSet.add(id);
      });
    }
    if (req.includeOnline && Array.isArray(req.onlineUids)) {
      req.onlineUids.forEach((id) => {
        if (typeof id === "string" && id.trim()) keepSet.add(id);
      });
    }
    const keep = Array.from(keepSet);

    const shouldPrune = (() => {
      try {
        const raw = (process.env.NEXT_PUBLIC_RESET_PRUNE || "").toString().toLowerCase();
        if (!raw) return true;
        return !(raw === "0" || raw === "false");
      } catch {
        return true;
      }
    })();

    let pruneTargets = 0;
    if (shouldPrune && Array.isArray(req.roundIds) && req.roundIds.length > 0) {
      const targets = req.roundIds.filter((id) => !keepSet.has(id));
      pruneTargets = targets.length;
      if (targets.length > 0) {
        try {
          const auth = getAuth();
          const user = auth.currentUser;
          const token = await user?.getIdToken();
          if (token && user?.uid) {
            await fetch(`/api/rooms/${req.roomId}/prune`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token,
                callerUid: user.uid,
                targets,
                clientVersion: APP_VERSION,
              }),
            }).catch(() => {});
          }
        } catch {
          // prune failures are non-fatal
        }
      }
    }

    traceAction("ui.room.reset", {
      roomId: req.roomId,
      keep: String(keep.length),
      prune: shouldPrune ? "1" : "0",
      recall: req.recallSpectators ? "1" : "0",
    });

    const sessionId = await resolveSessionId();

    const runReset = () =>
      resetRoomWithPruneImpl(req.roomId, keep, {
        notifyChat: true,
        recallSpectators: req.recallSpectators ?? true,
        requestId: resetRequestId,
        sessionId,
      });

    const confirmResetApplied = async () => {
      const room = await fetchRoomSnapshot(req.roomId);
      return (
        room?.status === "waiting" &&
        typeof room.resetRequestId === "string" &&
        room.resetRequestId === resetRequestId
      );
    };

    try {
      await runReset();
    } catch (error) {
      if (!isTransientNetworkError(error)) {
        throw error;
      }
      traceAction("ui.room.reset.retry", {
        roomId: req.roomId,
        requestId: resetRequestId,
        message: getErrorMessage(error),
      });
      await sleep(650);
      try {
        await runReset();
      } catch (retryError) {
        const code = (retryError as Partial<ApiError> | null)?.code;
        if ((code === "rate_limited" || isTransientNetworkError(retryError)) && (await confirmResetApplied())) {
          traceAction("ui.room.reset.retry.applied", {
            roomId: req.roomId,
            requestId: resetRequestId,
          });
        } else {
          throw retryError;
        }
      }
    }

    try {
      postRoundReset(req.roomId);
    } catch {}

    return { ok: true, keptCount: keep.length, pruneTargets };
  };
}

