import { useMemo } from "react";
import type { RoomDoc } from "@/lib/types";
import { computeBoardActiveProposal } from "@/lib/game/selectors";

export function useBoardActiveProposal(params: {
  status: RoomDoc["status"];
  orderList: string[];
  proposal?: (string | null)[];
  eligibleIdSet: ReadonlySet<string>;
  orderListKey: string;
  proposalKey: string;
}): (string | null)[] {
  const { status, orderList, proposal, eligibleIdSet, orderListKey, proposalKey } =
    params;

  return useMemo<(string | null)[]>(() => {
    return computeBoardActiveProposal({
      status,
      orderList,
      proposal,
      eligibleIdSet,
      orderListKey,
      proposalKey,
    });
  }, [status, orderList, proposal, eligibleIdSet, orderListKey, proposalKey]);
}

