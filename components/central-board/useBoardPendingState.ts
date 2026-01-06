import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

type PendingState = (string | null)[];
type PendingStateUpdater = (updater: (prev: PendingState) => PendingState) => void;

const shallowArrayEqual = (
  a: readonly (string | null)[],
  b: readonly (string | null)[]
) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

export function useBoardPendingState(params: {
  pending: PendingState;
  setPending: Dispatch<SetStateAction<PendingState>>;
}): { pendingRef: MutableRefObject<PendingState>; updatePendingState: PendingStateUpdater } {
  const { pending, setPending } = params;

  const pendingRef = useRef<PendingState>(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const updatePendingState = useCallback<PendingStateUpdater>(
    (updater) => {
      setPending((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        return shallowArrayEqual(prev, next) ? prev : next;
      });
    },
    [setPending]
  );

  return { pendingRef, updatePendingState };
}

