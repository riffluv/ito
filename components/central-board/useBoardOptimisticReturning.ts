import { useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { RoomDoc } from "@/lib/types";
import { useOptimisticReturningIds } from "./useOptimisticReturningIds";

type PendingStateUpdater = (updater: (prev: (string | null)[]) => (string | null)[]) => void;

export function useBoardOptimisticReturning(params: {
  roomId: string;
  roomStatus: RoomDoc["status"];
  proposal: (string | null)[] | null | undefined;
  proposalKey: string;
  optimisticReturningIds: string[];
  setOptimisticReturningIds: Dispatch<SetStateAction<string[]>>;
  updatePendingState: PendingStateUpdater;
  playCardPlace: () => void;
  playDropInvalid: () => void;
}): {
  returningTimeoutsRef: MutableRefObject<Map<string, ReturnType<typeof setTimeout>>>;
  returnCardToWaiting: (playerId: string) => Promise<boolean>;
} {
  const returningTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const { returnCardToWaiting } = useOptimisticReturningIds({
    ...params,
    returningTimeoutsRef,
  });

  return { returningTimeoutsRef, returnCardToWaiting };
}

