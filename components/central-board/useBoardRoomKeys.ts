import { useMemo } from "react";

export function useBoardRoomKeys(params: {
  orderList: string[];
  proposal?: (string | null)[];
}): {
  orderListKey: string;
  proposalKey: string;
  orderListLength: number;
} {
  const { orderList, proposal } = params;

  const orderListKey = useMemo(
    () => (Array.isArray(orderList) ? orderList.join(",") : ""),
    [orderList]
  );
  const proposalKey = useMemo(
    () => (Array.isArray(proposal) ? proposal.join(",") : ""),
    [proposal]
  );
  const orderListLength = Array.isArray(orderList) ? orderList.length : 0;

  return { orderListKey, proposalKey, orderListLength };
}

