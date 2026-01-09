import { withPermissionRetry } from "@/lib/firebase/permissionGuard";
import { traceAction, traceError } from "@/lib/utils/trace";
import { apiResetRoom } from "@/lib/services/roomApiClient";
import type { ResetRoomKeepIds, ResetRoomOptions } from "@/lib/game/serviceParts/types";

export async function resetRoomWithPrune(
  roomId: string,
  keepIds: ResetRoomKeepIds,
  opts: ResetRoomOptions & { requestId: string; sessionId?: string | null }
) {
  traceAction("room.reset", {
    roomId,
    keep: Array.isArray(keepIds)
      ? String(keepIds.length)
      : keepIds === null || keepIds === undefined
        ? "0"
        : "custom",
  });
  try {
    return await withPermissionRetry(
      () =>
        apiResetRoom(
          roomId,
          opts?.recallSpectators ?? true,
          opts?.requestId,
          opts?.sessionId
        ),
      { context: "room.reset", toastContext: "ゲームのリセット" }
    );
  } catch (error) {
    traceError("room.reset", error, {
      roomId,
      keep: Array.isArray(keepIds)
        ? String(keepIds.length)
        : keepIds === null || keepIds === undefined
          ? "0"
          : "custom",
    });
    throw error;
  }
}

