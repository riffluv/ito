import { withPermissionRetry } from "@/lib/firebase/permissionGuard";
import { traceAction, traceError } from "@/lib/utils/trace";
import { apiCommitPlay } from "@/lib/services/roomApiClient";

export async function commitPlayFromClue(roomId: string, playerId: string) {
  traceAction("clue.commit", { roomId, playerId });
  try {
    return await withPermissionRetry(() => apiCommitPlay(roomId, playerId), {
      context: "clue.commit",
      toastContext: "ヒント提出",
    });
  } catch (error) {
    traceError("clue.commit", error, { roomId, playerId });
    throw error;
  }
}

