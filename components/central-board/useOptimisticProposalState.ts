import { notify } from "@/components/ui/notify";
import type { RoomDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { unstable_batchedUpdates } from "react-dom";

import {
  buildOptimisticProposalSnapshot,
  buildOptimisticStateKey,
  buildProposalSignature,
  buildRenderedProposalForSignature,
  sanitizeOptimisticProposal,
} from "./optimisticReorder";

type PendingStateUpdater = (updater: (prev: (string | null)[]) => (string | null)[]) => void;

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

export function useOptimisticProposalState(params: {
  roomId: string;
  roomStatus: RoomDoc["status"];
  activeProposal: (string | null)[];
  serverProposal: (string | null)[] | undefined;
  serverProposalKey: string;
  pending: (string | null)[];
  pendingRef: MutableRefObject<(string | null)[]>;
  setPending: Dispatch<SetStateAction<(string | null)[]>>;
  updatePendingState: PendingStateUpdater;
  optimisticReturningIds: string[];
  setOptimisticReturningIds: Dispatch<SetStateAction<string[]>>;
  returningTimeoutsRef: MutableRefObject<
    Map<string, ReturnType<typeof setTimeout>>
  >;
  presenceReady: boolean;
  prefersReducedMotion: boolean;
  onOptimisticProposalChange?: (
    playerId: string,
    state: "placed" | "removed" | null
  ) => void;
}): {
  optimisticProposal: (string | null)[] | null;
  boardProposal: (string | null)[];
  clearOptimisticProposal: () => void;
  applyOptimisticReorder: (playerId: string, targetIndex: number) => void;
  scheduleDropRollback: (playerId: string, snapshot: (string | null)[]) => void;
  clearDropRollbackTimer: (playerId?: string) => void;
} {
  const {
    roomId,
    roomStatus,
    activeProposal,
    serverProposal,
    serverProposalKey,
    pending,
    pendingRef,
    setPending,
    updatePendingState,
    optimisticReturningIds,
    setOptimisticReturningIds,
    returningTimeoutsRef,
    presenceReady,
    prefersReducedMotion,
    onOptimisticProposalChange,
  } = params;

  const latestActiveProposalRef = useRef<(string | null)[]>(activeProposal);
  useEffect(() => {
    latestActiveProposalRef.current = activeProposal;
  }, [activeProposal]);

  const [optimisticProposal, setOptimisticProposal] = useState<
    (string | null)[] | null
  >(null);

  const boardProposal = optimisticProposal ?? activeProposal;

  const pendingHasContent = useMemo(
    () => pending.some((id) => typeof id === "string" && id.length > 0),
    [pending]
  );

  const renderedProposalForSignature = useMemo<(string | null)[]>(() => {
    return buildRenderedProposalForSignature({
      activeProposal,
      optimisticProposal,
      pending,
      optimisticReturningIds,
    });
  }, [activeProposal, optimisticProposal, pending, optimisticReturningIds]);

  const renderedProposalSignature = useMemo(
    () => buildProposalSignature(renderedProposalForSignature),
    [renderedProposalForSignature]
  );

  const serverProposalSignature = useMemo(
    () => buildProposalSignature(activeProposal),
    [activeProposal]
  );

  const optimisticStateKey = useMemo(() => {
    return buildOptimisticStateKey({
      optimisticProposal,
      pending,
      optimisticReturningIds,
    });
  }, [optimisticProposal, pending, optimisticReturningIds]);

  const hasOptimisticState = useMemo(
    () =>
      Boolean(optimisticProposal) ||
      pendingHasContent ||
      optimisticReturningIds.length > 0,
    [optimisticProposal, pendingHasContent, optimisticReturningIds.length]
  );

  const dropRollbackTimersRef = useRef<Map<string, number>>(new Map());
  const dropRollbackSnapshotsRef = useRef<Map<string, (string | null)[]>>(
    new Map()
  );
  const forceResyncTimerRef = useRef<number | null>(null);
  const optimisticSessionRef = useRef(0);

  const clearDropRollbackTimer = useCallback((playerId?: string) => {
    if (!playerId) {
      if (typeof window !== "undefined") {
        dropRollbackTimersRef.current.forEach((timer) =>
          window.clearTimeout(timer)
        );
      }
      dropRollbackTimersRef.current.clear();
      dropRollbackSnapshotsRef.current.clear();
      return;
    }
    const timer = dropRollbackTimersRef.current.get(playerId);
    if (typeof window !== "undefined" && typeof timer === "number") {
      window.clearTimeout(timer);
    }
    dropRollbackTimersRef.current.delete(playerId);
    dropRollbackSnapshotsRef.current.delete(playerId);
  }, []);

  const clearForceResyncTimer = useCallback(() => {
    if (forceResyncTimerRef.current) {
      clearTimeout(forceResyncTimerRef.current);
      forceResyncTimerRef.current = null;
    }
  }, []);

  const resetOptimisticState = useCallback(
    (reason: "hash-mismatch" | "forced-sync") => {
      if (!optimisticProposal && !pendingHasContent && optimisticReturningIds.length === 0) {
        return;
      }
      clearForceResyncTimer();
      clearDropRollbackTimer();
      dropRollbackSnapshotsRef.current.clear();
      const returningMap = returningTimeoutsRef.current;
      returningMap.forEach((timeout) => clearTimeout(timeout));
      returningMap.clear();
      pendingRef.current = [];
      unstable_batchedUpdates(() => {
        setOptimisticProposal(null);
        setPending(() => []);
        setOptimisticReturningIds([]);
      });
      traceAction("proposal.resync", {
        roomId,
        reason,
        serverSig: serverProposalSignature,
        localSig: renderedProposalSignature,
      });
    },
    [
      clearDropRollbackTimer,
      clearForceResyncTimer,
      optimisticProposal,
      pendingHasContent,
      optimisticReturningIds.length,
      pendingRef,
      renderedProposalSignature,
      returningTimeoutsRef,
      roomId,
      serverProposalSignature,
      setOptimisticReturningIds,
      setPending,
    ]
  );

  useEffect(() => {
    if (roomStatus === "waiting") {
      resetOptimisticState("forced-sync");
    }
  }, [roomStatus, resetOptimisticState]);

  const clearOptimisticProposal = useCallback(() => {
    setOptimisticProposal(null);
  }, []);

  const applyOptimisticReorder = useCallback(
    (playerId: string, targetIndex: number) => {
      setOptimisticProposal((prev) => {
        const next = buildOptimisticProposalSnapshot(
          prev ?? boardProposal,
          playerId,
          targetIndex
        );
        return next ?? prev ?? null;
      });
    },
    [boardProposal]
  );

  const scheduleDropRollback = useCallback(
    (playerId: string, snapshot: (string | null)[]) => {
      if (typeof window === "undefined") return;
      clearDropRollbackTimer(playerId);
      dropRollbackSnapshotsRef.current.set(playerId, snapshot.slice());
      const timeoutMs = prefersReducedMotion ? 1400 : 1700;
      const handle = window.setTimeout(() => {
        dropRollbackTimersRef.current.delete(playerId);
        const latestServerProposal = latestActiveProposalRef.current;
        if (latestServerProposal.includes(playerId)) {
          dropRollbackSnapshotsRef.current.delete(playerId);
          return;
        }
        const rollback = dropRollbackSnapshotsRef.current.get(playerId);
        dropRollbackSnapshotsRef.current.delete(playerId);
        if (!rollback) return;
        updatePendingState(() => rollback.slice());
        onOptimisticProposalChange?.(playerId, null);
        notify({
          title: "配置を巻き戻しました",
          description: "サーバー反映が遅延したためローカル状態をリセットしました。",
          type: "info",
          duration: 1400,
        });
      }, timeoutMs);
      dropRollbackTimersRef.current.set(playerId, handle);
    },
    [
      clearDropRollbackTimer,
      onOptimisticProposalChange,
      prefersReducedMotion,
      updatePendingState,
    ]
  );

  const lastServerSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasOptimisticState) {
      lastServerSignatureRef.current = serverProposalSignature;
      return undefined;
    }
    if (serverProposalSignature === lastServerSignatureRef.current) {
      return undefined;
    }
    lastServerSignatureRef.current = serverProposalSignature;
    if (renderedProposalSignature === serverProposalSignature) {
      return undefined;
    }
    resetOptimisticState("hash-mismatch");
    return undefined;
  }, [
    hasOptimisticState,
    renderedProposalSignature,
    resetOptimisticState,
    serverProposalSignature,
  ]);

  useEffect(() => {
    if (!presenceReady) {
      resetOptimisticState("forced-sync");
    }
  }, [presenceReady, resetOptimisticState]);

  useEffect(() => {
    if (!hasOptimisticState) {
      clearForceResyncTimer();
      return undefined;
    }
    if (typeof window === "undefined") return undefined;
    const sessionId = optimisticSessionRef.current + 1;
    optimisticSessionRef.current = sessionId;
    clearForceResyncTimer();
    const timeoutMs = prefersReducedMotion ? 1900 : 1700;
    forceResyncTimerRef.current = window.setTimeout(() => {
      if (optimisticSessionRef.current !== sessionId) return;
      resetOptimisticState("forced-sync");
      forceResyncTimerRef.current = null;
    }, timeoutMs);
    return () => {
      clearForceResyncTimer();
    };
  }, [
    clearForceResyncTimer,
    hasOptimisticState,
    optimisticStateKey,
    prefersReducedMotion,
    resetOptimisticState,
  ]);

  useEffect(() => {
    if (!optimisticProposal) return;
    const optimisticKey = buildProposalSignature(optimisticProposal);
    if (optimisticKey === serverProposalSignature) {
      setOptimisticProposal(null);
    }
  }, [optimisticProposal, serverProposalSignature]);

  useEffect(() => {
    if (!optimisticProposal) return;
    const sanitized = sanitizeOptimisticProposal({
      optimisticProposal,
      serverProposal,
    });
    if (!sanitized) {
      setOptimisticProposal(null);
      return;
    }
    if (shallowArrayEqual(optimisticProposal, sanitized)) return;
    setOptimisticProposal(sanitized);
  }, [optimisticProposal, serverProposal, serverProposalKey]);

  useEffect(() => {
    if (roomStatus !== "clue" && optimisticProposal) {
      setOptimisticProposal(null);
    }
  }, [roomStatus, optimisticProposal]);

  useEffect(() => {
    const onVis = () => {
      try {
        if (document.visibilityState === "hidden") {
          updatePendingState((cur) => (cur.length === 0 ? cur : []));
          clearOptimisticProposal();
          setOptimisticReturningIds([]);
        }
      } catch {}
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }
    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
    };
  }, [clearOptimisticProposal, setOptimisticReturningIds, updatePendingState]);

  useEffect(() => {
    return () => {
      if (
        typeof window !== "undefined" &&
        forceResyncTimerRef.current !== null
      ) {
        window.clearTimeout(forceResyncTimerRef.current);
        forceResyncTimerRef.current = null;
      }
      if (typeof window !== "undefined" && dropRollbackTimersRef.current.size > 0) {
        dropRollbackTimersRef.current.forEach((timer) => window.clearTimeout(timer));
        dropRollbackTimersRef.current.clear();
      }
      dropRollbackSnapshotsRef.current.clear();
    };
  }, []);

  return {
    optimisticProposal,
    boardProposal,
    clearOptimisticProposal,
    applyOptimisticReorder,
    scheduleDropRollback,
    clearDropRollbackTimer,
  };
}
