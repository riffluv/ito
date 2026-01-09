import { notify } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import type { ShowtimeIntentHandlers } from "@/lib/showtime/types";
import type { HostActionsController } from "@/lib/host/HostActionsController";

import { describeSubmitOrderError } from "@/lib/hooks/hostActions/describeSubmitOrderError";
import { normalizeProposalList } from "@/lib/hooks/hostActions/normalizeProposalList";

const REVEAL_DELAY_MS = 500;

export async function runEvalSortedSubmit(params: {
  roomId: string;
  proposal?: (string | null)[] | null;
  hostActions: HostActionsController;
  showtimeIntents?: ShowtimeIntentHandlers;
  playOrderConfirm: () => void;
  evalSortedPendingRef: { current: boolean };
  mountedRef: { current: boolean };
  setEvalSortedPending: (pending: boolean) => void;
}): Promise<boolean> {
  const {
    roomId,
    proposal,
    hostActions,
    showtimeIntents,
    playOrderConfirm,
    evalSortedPendingRef,
    mountedRef,
    setEvalSortedPending,
  } = params;

  if (evalSortedPendingRef.current) return false;

  const list = normalizeProposalList(proposal);
  if (list.length === 0) return false;

  evalSortedPendingRef.current = true;
  if (mountedRef.current) {
    setEvalSortedPending(true);
  }

  showtimeIntents?.markRevealIntent?.({
    action: "evalSorted",
    source: "useHostActions",
  });
  playOrderConfirm();

  const startedAt = typeof performance !== "undefined" ? performance.now() : null;
  try {
    traceAction("ui.order.submit", { roomId, count: list.length });
    await hostActions.evaluateSortedOrder({
      roomId,
      list,
      revealDelayMs: REVEAL_DELAY_MS,
    });
    if (startedAt !== null) {
      setMetric(
        "order",
        "submitSortedOrderSuccessMs",
        Math.round(performance.now() - startedAt)
      );
    }
    return true;
  } catch (error: unknown) {
    if (startedAt !== null) {
      setMetric(
        "order",
        "submitSortedOrderFailureMs",
        Math.round(performance.now() - startedAt)
      );
    }
    traceError("ui.order.submit", error, { roomId, count: list.length });
    const { code, status, reason, url, description } = describeSubmitOrderError(error);
    console.warn("[order] submit failed", {
      roomId,
      count: list.length,
      code,
      status,
      reason,
      url,
      error,
    });
    notify({
      id: toastIds.genericError(roomId, "submit-order"),
      title: "並びの確定に失敗しました",
      description,
      type: "error",
    });
    throw error;
  } finally {
    evalSortedPendingRef.current = false;
    if (mountedRef.current) {
      setEvalSortedPending(false);
    }
  }
}

