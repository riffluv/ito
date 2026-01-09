import { withPermissionRetry } from "@/lib/firebase/permissionGuard";
import { traceAction, traceError } from "@/lib/utils/trace";
import { apiMutateProposal, apiPruneProposal } from "@/lib/services/roomApiClient";

export async function addCardToProposal(roomId: string, playerId: string) {
  traceAction("card.add", { roomId, playerId });
  try {
    return await withPermissionRetry(
      () =>
        apiMutateProposal({ roomId, playerId, action: "add", targetIndex: -1 }).then(
          (r) => r.status
        ),
      { context: "card.add", toastContext: "カードを置く操作" }
    );
  } catch (error) {
    traceError("card.add", error, { roomId, playerId });
    throw error;
  }
}

export async function removeCardFromProposal(roomId: string, playerId: string) {
  traceAction("card.remove", { roomId, playerId });
  try {
    return await withPermissionRetry(
      () => apiMutateProposal({ roomId, playerId, action: "remove" }).then((r) => r.status),
      { context: "card.remove", toastContext: "カードを戻す操作" }
    );
  } catch (error) {
    traceError("card.remove", error, { roomId, playerId });
    throw error;
  }
}

// clue中のみ、proposalから在室外IDを除去（冪等）。UI側の表示フィルタと合わせて二重で安全策。
export async function pruneProposalByEligible(roomId: string, eligibleIds: readonly string[]) {
  try {
    await withPermissionRetry(
      () => apiPruneProposal(roomId, Array.from(eligibleIds)),
      { context: "order.proposal.prune", suppressToast: true }
    );
  } catch (error) {
    traceError("order.proposal.prune", error, { roomId });
  }
}

