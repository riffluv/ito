import { useEffect, useRef } from "react";
import { traceAction } from "@/lib/utils/trace";

import { countActiveProposalIds } from "./boardDerivations";

export function useProposalSyncTrace(params: {
  proposalKey: string;
  roomId: string;
  activeProposal: (string | null)[];
  orderListLength: number;
}): void {
  const { proposalKey, roomId, activeProposal, orderListLength } = params;
  const proposalSyncRef = useRef<string | null>(null);

  useEffect(() => {
    if (!proposalKey) {
      proposalSyncRef.current = null;
      return;
    }
    if (proposalSyncRef.current === proposalKey) {
      return;
    }
    proposalSyncRef.current = proposalKey;
    const activeCount = countActiveProposalIds(activeProposal);
    traceAction("proposal.sync", {
      roomId,
      activeProposalLen: activeCount,
      orderListLen: orderListLength,
      source: "firestore",
    });
  }, [proposalKey, roomId, activeProposal, orderListLength]);
}

