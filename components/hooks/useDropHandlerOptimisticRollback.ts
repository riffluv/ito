import { notify } from "@/components/ui/notify";
import { traceAction } from "@/lib/utils/trace";
import { useCallback, useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";

// Align rollbackウィンドウをCentralCardBoard側（~1.7s）と揃え、
// 遅延時の早すぎる巻き戻りを防ぐ
const OPTIMISTIC_ROLLBACK_MS = 1700;

export function useDropHandlerOptimisticRollback(params: {
  optimisticMode: boolean;
  roomId: string;
  meId: string;
  sanitizedProposal: string[];
  setPending: Dispatch<SetStateAction<(string | null)[]>>;
}): {
  scheduleOptimisticRollback: (
    pid: string,
    snapshot: (string | null)[],
    targetIndex?: number
  ) => void;
  clearOptimisticEntry: (pid: string) => void;
} {
  const { optimisticMode, roomId, meId, sanitizedProposal, setPending } = params;

  const proposalSignature = useMemo(
    () => (sanitizedProposal.length > 0 ? sanitizedProposal.join(",") : "none"),
    [sanitizedProposal]
  );

  const latestProposalRef = useRef<string[]>([]);
  const optimisticEntriesRef = useRef<
    Map<
      string,
      {
        snapshot: (string | null)[];
        timer: number | null;
        targetIndex?: number;
      }
    >
  >(new Map());

  useEffect(() => {
    latestProposalRef.current = sanitizedProposal.slice();
  }, [sanitizedProposal]);

  const scheduleOptimisticRollback = useCallback(
    (pid: string, snapshot: (string | null)[], targetIndex?: number) => {
      if (!optimisticMode) return;
      if (typeof window === "undefined") return;
      const existing = optimisticEntriesRef.current.get(pid);
      if (existing?.timer) {
        clearTimeout(existing.timer);
      }
      const snapshotCopy = Array.isArray(snapshot) ? snapshot.slice() : [];
      const timer = window.setTimeout(() => {
        const latest = latestProposalRef.current;
        if (latest.includes(pid)) {
          optimisticEntriesRef.current.delete(pid);
          return;
        }
        setPending(() => snapshotCopy);
        optimisticEntriesRef.current.delete(pid);
        traceAction("interaction.drop.rollback", {
          roomId,
          playerId: meId,
          index: typeof targetIndex === "number" ? targetIndex : undefined,
        });
        notify({
          title: "配置を巻き戻しました",
          description: "サーバーの結果と一致しませんでした。",
          type: "warning",
        });
      }, OPTIMISTIC_ROLLBACK_MS);
      optimisticEntriesRef.current.set(pid, {
        snapshot: snapshotCopy,
        timer,
        targetIndex,
      });
    },
    [meId, optimisticMode, roomId, setPending]
  );

  const clearOptimisticEntry = useCallback((pid: string) => {
    const entry = optimisticEntriesRef.current.get(pid);
    if (entry?.timer) {
      clearTimeout(entry.timer);
    }
    if (entry) {
      optimisticEntriesRef.current.delete(pid);
    }
  }, []);

  useEffect(() => {
    if (!optimisticMode) return;
    const latest = latestProposalRef.current;
    if (!Array.isArray(latest) || latest.length === 0) return;
    const proposalIndexMap = new Map<string, number>();
    latest.forEach((value, idx) => {
      if (typeof value === "string" && value.length > 0) {
        proposalIndexMap.set(value, idx);
      }
    });
    if (proposalIndexMap.size === 0) return;
    setPending((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.slice();
      for (let idx = 0; idx < next.length; idx += 1) {
        const value = next[idx];
        if (typeof value !== "string" || value.length === 0) continue;
        const remoteIndex = proposalIndexMap.get(value);
        if (typeof remoteIndex !== "number") continue;
        if (remoteIndex !== idx) continue;
        next[idx] = null;
        changed = true;
        clearOptimisticEntry(value);
      }
      if (!changed) return prev;
      while (next.length > 0) {
        const tail = next[next.length - 1];
        if (tail === null || typeof tail === "undefined") {
          next.pop();
          continue;
        }
        break;
      }
      return next;
    });
  }, [clearOptimisticEntry, optimisticMode, proposalSignature, setPending]);

  const resetOptimisticEntries = useCallback(() => {
    optimisticEntriesRef.current.forEach((entry) => {
      if (entry.timer) {
        clearTimeout(entry.timer);
      }
    });
    optimisticEntriesRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      resetOptimisticEntries();
    };
  }, [resetOptimisticEntries]);

  return {
    scheduleOptimisticRollback,
    clearOptimisticEntry,
  };
}

