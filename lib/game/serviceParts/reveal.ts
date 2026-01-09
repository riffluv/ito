import { withPermissionRetry } from "@/lib/firebase/permissionGuard";
import { traceAction, traceError } from "@/lib/utils/trace";
import { apiFinalizeReveal, apiSetRevealPending } from "@/lib/services/roomApiClient";

export async function finalizeReveal(roomId: string) {
  traceAction("reveal.finalize", { roomId });
  try {
    return await withPermissionRetry(() => apiFinalizeReveal(roomId), {
      context: "reveal.finalize",
      toastContext: "結果確定",
    });
  } catch (error) {
    traceError("reveal.finalize", error, { roomId });
    throw error;
  }
}

// =============================
// UI Shared Gate: revealPending
// =============================

export async function beginRevealPending(roomId: string) {
  try {
    traceAction("ui.revealPending.begin", { roomId });
    await withPermissionRetry(() => apiSetRevealPending(roomId, true), {
      context: "ui.revealPending.begin",
      suppressToast: true,
    });
  } catch (error) {
    traceError("ui.revealPending.begin", error, { roomId });
    throw error;
  }
}

export async function clearRevealPending(roomId: string) {
  try {
    traceAction("ui.revealPending.clear", { roomId });
    await withPermissionRetry(() => apiSetRevealPending(roomId, false), {
      context: "ui.revealPending.clear",
      suppressToast: true,
    });
  } catch (error) {
    traceError("ui.revealPending.clear", error, { roomId });
    // 非致命: 失敗してもUIは自動解除されるため握りつぶす
  }
}

