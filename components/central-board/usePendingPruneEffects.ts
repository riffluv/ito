import { prunePendingSlotsInPlace } from "@/components/central-board/optimisticReorder";
import { useEffect, useMemo } from "react";

type PendingStateUpdater = (updater: (prev: (string | null)[]) => (string | null)[]) => void;

export function usePendingPruneEffects(params: {
  orderList: string[];
  orderListKey: string;
  proposal: (string | null)[] | undefined;
  proposalKey: string;
  updatePendingState: PendingStateUpdater;
}) {
  const { orderList, orderListKey, proposal, proposalKey, updatePendingState } = params;

  const orderListSet = useMemo(() => {
    if (!orderListKey && (!orderList || orderList.length === 0)) {
      return new Set<string>();
    }
    return new Set(orderList || []);
  }, [orderList, orderListKey]);

  useEffect(() => {
    if (!orderList || orderList.length === 0 || orderListSet.size === 0) return;
    updatePendingState((cur) => {
      if (cur.length === 0) return cur;
      let changed = false;
      const next = cur.slice();
      for (let idx = 0; idx < next.length; idx += 1) {
        const value = next[idx];
        if (typeof value !== "string" || value.length === 0) continue;
        if (!orderListSet.has(value)) continue;
        next[idx] = null;
        changed = true;
      }
      if (!changed) return cur;
      return prunePendingSlotsInPlace(next);
    });
  }, [orderList, orderListKey, orderListSet, updatePendingState]);

  useEffect(() => {
    if (!proposal || proposal.length === 0) return;
    const proposalIndexMap = new Map<string, number>();
    proposal.forEach((value, idx) => {
      if (typeof value === "string" && value.length > 0) {
        proposalIndexMap.set(value, idx);
      }
    });
    if (proposalIndexMap.size === 0) return;
    updatePendingState((cur) => {
      if (cur.length === 0) return cur;
      let changed = false;
      const next = cur.slice();
      for (let idx = 0; idx < next.length; idx += 1) {
        const pendingId = next[idx];
        if (typeof pendingId !== "string" || pendingId.length === 0) continue;
        const remoteIdx = proposalIndexMap.get(pendingId);
        if (typeof remoteIdx !== "number") continue;
        if (remoteIdx !== idx) continue;
        next[idx] = null;
        changed = true;
      }
      if (!changed) return cur;
      return prunePendingSlotsInPlace(next);
    });
  }, [proposal, proposalKey, updatePendingState]);
}

