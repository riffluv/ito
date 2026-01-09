import { withPermissionRetry } from "@/lib/firebase/permissionGuard";
import { traceAction, traceError } from "@/lib/utils/trace";
import { apiSetRoundPreparing } from "@/lib/services/roomApiClient";

export async function setRoundPreparing(roomId: string, active: boolean) {
  try {
    traceAction(active ? "ui.roundPreparing.begin" : "ui.roundPreparing.clear", { roomId });
    await withPermissionRetry(() => apiSetRoundPreparing(roomId, active), {
      context: "ui.roundPreparing",
      suppressToast: true,
    });
  } catch (error) {
    traceError("ui.roundPreparing", error, { roomId, active });
  }
}

