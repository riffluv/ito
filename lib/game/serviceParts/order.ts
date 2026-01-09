import { withPermissionRetry } from "@/lib/firebase/permissionGuard";
import { traceAction, traceError } from "@/lib/utils/trace";
import { apiSubmitOrder } from "@/lib/services/roomApiClient";

export async function submitSortedOrder(roomId: string, list: string[]) {
  traceAction("order.submit", { roomId, size: list.length });
  try {
    return await withPermissionRetry(() => apiSubmitOrder(roomId, list), {
      context: "order.submit",
      toastContext: "並び順の提出",
    });
  } catch (error) {
    traceError("order.submit", error, { roomId, size: list.length });
    throw error;
  }
}

