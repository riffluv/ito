import type { DealNumbersOptions } from "@/lib/game/room";
import { withPermissionRetry } from "@/lib/firebase/permissionGuard";
import { traceAction, traceError } from "@/lib/utils/trace";
import { apiDealNumbers } from "@/lib/services/roomApiClient";

export async function dealNumbers(roomId: string, options?: DealNumbersOptions) {
  traceAction("numbers.deal", { roomId });
  try {
    const requestId =
      (options as { requestId?: string } | undefined)?.requestId ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return await withPermissionRetry(
      async () => {
        const result = await apiDealNumbers(roomId, {
          skipPresence: options?.skipPresence,
          requestId,
          sessionId:
            (options as { sessionId?: string | null } | undefined)?.sessionId ?? undefined,
        });
        return result.count;
      },
      { context: "numbers.deal", toastContext: "カード配布" }
    );
  } catch (error) {
    traceError("numbers.deal", error, { roomId });
    throw error;
  }
}

