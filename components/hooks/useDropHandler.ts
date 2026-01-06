import { notify } from "@/components/ui/notify";
import { scheduleAddCardToProposalAtPosition } from "@/lib/game/proposalScheduler";
import { addCardToProposal } from "@/lib/game/service";
import type { PlayerDoc } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSoundManager } from "@/lib/audio/SoundProvider";
import { traceAction, traceError } from "@/lib/utils/trace";
import { useDropSounds } from "./dropHandlerSounds";
import {
  useDropEligibility,
} from "./dropHandlerEligibility";
import { createDropMetricsSession } from "./dropMetrics";

export const DROP_OPTIMISTIC_ENABLED =
  process.env.NEXT_PUBLIC_UI_DROP_OPTIMISTIC === "1";

// Align rollbackウィンドウをCentralCardBoard側（~1.7s）と揃え、
// 遅延時の早すぎる巻き戻りを防ぐ
const OPTIMISTIC_ROLLBACK_MS = 1700;

interface UseDropHandlerProps {
  roomId: string;
  meId: string;
  me: (PlayerDoc & { id: string }) | undefined;
  roomStatus?: string;
  orderList?: string[];
  proposal?: (string | null)[];
  hasNumber: boolean;
  mePlaced: boolean;
  dealReady: boolean;
  dealGuardActive?: boolean;
  presenceReady?: boolean;
  interactionEnabled?: boolean;
}

export function useDropHandler({
  roomId,
  meId,
  me,
  roomStatus,
  orderList,
  proposal: _proposal,
  hasNumber,
  mePlaced: _mePlaced,
  dealReady,
  dealGuardActive = false,
  presenceReady = true,
  interactionEnabled = true,
}: UseDropHandlerProps) {
  const soundManager = useSoundManager();
  const { playSuccessSound, playInvalidSound } = useDropSounds(roomId);
  const { canDrop, ensureCanDrop } = useDropEligibility({
    roomStatus,
    presenceReady,
    hasNumber,
    me,
    meId,
    roomId,
    playInvalidSound,
    dealReady,
    dealGuardActive,
    interactionEnabled,
  });

  const logDropRejection = useCallback(
    (reason: string, extra?: { index?: number }) => {
      traceAction("board.drop.attempt", {
        roomId,
        playerId: meId,
        reasonIfRejected: reason,
        targetSlot: typeof extra?.index === "number" ? extra.index : undefined,
      });
    },
    [meId, roomId]
  );

  const [pending, setPending] = useState<(string | null)[]>([]);
  const [isOver, setIsOver] = useState(false);
  const optimisticMode = DROP_OPTIMISTIC_ENABLED;
  const sanitizedProposal = useMemo(
    () =>
      Array.isArray(_proposal)
        ? _proposal.filter(
            (id): id is string => typeof id === "string" && id.length > 0
          )
        : [],
    [_proposal]
  );
  const proposalSignature = useMemo(
    () => (sanitizedProposal.length > 0 ? sanitizedProposal.join(",") : "none"),
    [sanitizedProposal]
  );

  const pointerUnlockArmedRef = useRef(false);
  const pointerUnlockDoneRef = useRef(false);
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
    const audioResumeEnabled = process.env.NEXT_PUBLIC_AUDIO_RESUME_ON_POINTER === "1";
    if (!audioResumeEnabled || typeof window === "undefined" || !soundManager) {
      return undefined;
    }

    if (roomStatus !== "clue") {
      pointerUnlockArmedRef.current = false;
      pointerUnlockDoneRef.current = false;
      return undefined;
    }
    if (pointerUnlockDoneRef.current || pointerUnlockArmedRef.current) {
      return undefined;
    }

    const handlePointer = () => {
      pointerUnlockDoneRef.current = true;
      pointerUnlockArmedRef.current = false;
      soundManager.markUserInteraction();
      void soundManager.prepareForInteraction();
    };

    pointerUnlockArmedRef.current = true;
    window.addEventListener("pointerdown", handlePointer, { passive: true, once: true });

    return () => {
      if (pointerUnlockArmedRef.current && !pointerUnlockDoneRef.current) {
        window.removeEventListener("pointerdown", handlePointer);
        pointerUnlockArmedRef.current = false;
      }
    };
  }, [roomStatus, soundManager]);

  useEffect(() => {
    if (!soundManager) return;
    if (!dealReady) return;
    void soundManager.prepareForInteraction();
  }, [dealReady, soundManager]);

  useEffect(() => {
    latestProposalRef.current = sanitizedProposal.slice();
  }, [sanitizedProposal]);

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
  }, [clearOptimisticEntry, optimisticMode, proposalSignature]);

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

  const canDropAtPosition = useMemo(() => {
    return (_targetIndex: number) => canDrop;
  }, [canDrop]);

  const currentPlaced = useMemo(() => {
    const base = Array.isArray(orderList) ? orderList : [];
    const pendingIds = pending.filter(
      (id): id is string => typeof id === "string" && id.length > 0
    );
    const extra = pendingIds.filter((id) => !base.includes(id));
    return [...base, ...extra];
  }, [orderList, pending]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const pid = e.dataTransfer.getData("text/plain");
      if (!pid) return;

      setIsOver(false);

      const session = createDropMetricsSession({ optimisticMode });
      const validation = ensureCanDrop(pid);
      if (!validation.ok) {
        session.abort(validation.outcome);
        logDropRejection(validation.reason ?? validation.outcome);
        return;
      }

      let previousPending: (string | null)[] = [];
      let inserted = false;
      let didPlaySound = false;
      let stageSoundMarked = false;
      let stageResolutionMarked = false;
      const playOnce = () => {
        if (didPlaySound) return;
        didPlaySound = true;
        playSuccessSound();
        if (!stageSoundMarked) {
          stageSoundMarked = true;
          session.markStage("client.drop.t3_soundPlayedMs", { channel: "success" });
        }
      };
      setPending((prev) => {
        previousPending = prev.slice();
        if (prev.includes(pid)) {
          return prev;
        }
        inserted = true;
        return [...prev, pid];
      });

      if (inserted) {
        scheduleOptimisticRollback(pid, previousPending.slice());
      }

      traceAction("interaction.drop.commit", {
        roomId,
        playerId: meId,
        target: "board",
        optimistic: optimisticMode,
        placed: inserted,
      });

      const request = addCardToProposal(roomId, meId);
      if (inserted) {
        playOnce();
      }

      request
        .then((result) => {
          if (!stageResolutionMarked) {
            stageResolutionMarked = true;
            session.markStage("client.drop.t2_addProposalResolvedMs", { result });
          }
          if (result === "noop") {
            session.complete("noop");
            if (inserted) {
              const snapshot = previousPending.slice();
              setPending(() => snapshot);
            }
            clearOptimisticEntry(pid);
            traceAction("interaction.drop.noop", {
              roomId,
              playerId: meId,
            });
            playInvalidSound();
            notify({
              title: "カードは既に提出済みです",
              type: "info",
            });
            logDropRejection("slot-occupied");
            return;
          }
          session.complete("success");
          traceAction("interaction.drop.success", {
            roomId,
            playerId: meId,
            optimistic: optimisticMode,
          });
        })
        .catch((err: unknown) => {
          if (!stageResolutionMarked) {
            stageResolutionMarked = true;
            session.markStage("client.drop.t2_addProposalResolvedMs", { result: "error" });
          }
          session.complete("error");
          const errorType =
            err instanceof Error
              ? err.name
              : err && typeof err === "object" && "code" in err
                ? String((err as { code?: unknown }).code ?? "unknown")
                : "unknown";
          traceError("interaction.drop.error", err, {
            roomId,
            errorType,
          });
          if (inserted) {
            const snapshot = previousPending.slice();
            setPending(() => snapshot);
          }
          clearOptimisticEntry(pid);
          playInvalidSound();
          const description =
            err instanceof Error
              ? err.message
              : err && typeof err === "object" && "message" in err
                ? String((err as { message?: unknown }).message ?? "")
                : undefined;
          notify({
            title: "配置に失敗しました",
            description: description || undefined,
            type: "error",
          });
          logDropRejection("error");
        });
    },
    [
      clearOptimisticEntry,
      ensureCanDrop,
      meId,
      optimisticMode,
      playInvalidSound,
      playSuccessSound,
      roomId,
      scheduleOptimisticRollback,
      logDropRejection,
    ]
  );

const onDropAtPosition = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      const pid = e.dataTransfer.getData("text/plain");
      if (!pid) return;

      setIsOver(false);

      const session = createDropMetricsSession({ optimisticMode, index: targetIndex });
      const validation = ensureCanDrop(pid);
      if (!validation.ok) {
        session.abort(validation.outcome);
        logDropRejection(validation.reason ?? validation.outcome, { index: targetIndex });
        return;
      }

      let previous: (string | null)[] = [];
      let inserted = false;
      let didPlaySound = false;
      let stageSoundMarked = false;
      let stageResolutionMarked = false;
      const playOnce = () => {
        if (didPlaySound) return;
        didPlaySound = true;
        playSuccessSound();
        if (!stageSoundMarked) {
          stageSoundMarked = true;
          session.markStage("client.drop.t3_soundPlayedMs", {
            channel: "success",
            index: String(targetIndex),
          });
        }
      };
      setPending((prev) => {
        previous = prev.slice();
        const next = [...prev];
        const exist = next.indexOf(pid);
        if (exist >= 0) next.splice(exist, 1);
        if (targetIndex >= next.length) next.length = targetIndex + 1;
        next[targetIndex] = pid;
        inserted = true;
        return next;
      });

      if (inserted) {
        scheduleOptimisticRollback(
          pid,
          previous.slice(),
          targetIndex
        );
      }

      traceAction("interaction.drop.commit", {
        roomId,
        playerId: meId,
        target: "position",
        index: targetIndex,
        optimistic: optimisticMode,
        placed: inserted,
      });

      const request = scheduleAddCardToProposalAtPosition(roomId, meId, targetIndex);
      if (inserted) {
        playOnce();
      }

      request
        .then((result) => {
          if (!stageResolutionMarked) {
            stageResolutionMarked = true;
            session.markStage("client.drop.t2_addProposalResolvedMs", {
              result,
              index: String(targetIndex),
            });
          }
          if (result === "noop") {
            session.complete("noop");
            if (inserted) {
              const snapshot = previous.slice();
              setPending(() => snapshot);
            }
            clearOptimisticEntry(pid);
            traceAction("interaction.drop.noop", {
              roomId,
              playerId: meId,
              index: targetIndex,
            });
            notify({
              title: "その位置には置けません",
              description: "別の位置を選ぶか、既存のカードを動かしてください。",
              type: "info",
            });
            playInvalidSound();
            logDropRejection("slot-occupied", { index: targetIndex });
            return;
          }

          session.complete("success");
          traceAction("interaction.drop.success", {
            roomId,
            playerId: meId,
            optimistic: optimisticMode,
            index: targetIndex,
          });
        })
        .catch((err: unknown) => {
          if (!stageResolutionMarked) {
            stageResolutionMarked = true;
            session.markStage("client.drop.t2_addProposalResolvedMs", {
              result: "error",
              index: String(targetIndex),
            });
          }
          session.complete("error");
          const errorType =
            err instanceof Error
              ? err.name
              : err && typeof err === "object" && "code" in err
                ? String((err as { code?: unknown }).code ?? "unknown")
                : "unknown";
          traceError("interaction.drop.error", err, {
            roomId,
            errorType,
            index: targetIndex,
          });
          if (inserted) {
            const snapshot = previous.slice();
            setPending(() => snapshot);
          }
          clearOptimisticEntry(pid);
          const description =
            err instanceof Error
              ? err.message
              : err && typeof err === "object" && "message" in err
                ? String((err as { message?: unknown }).message ?? "")
                : undefined;
          notify({
            title: "配置に失敗しました",
            description: description || undefined,
            type: "error",
          });
          logDropRejection("error", { index: targetIndex });
          playInvalidSound();
        });
    },
    [
      clearOptimisticEntry,
      ensureCanDrop,
      meId,
      optimisticMode,
      playInvalidSound,
      playSuccessSound,
      roomId,
      scheduleOptimisticRollback,
      logDropRejection,
    ]
  );

  return {
    pending,
    setPending,
    isOver,
    setIsOver,
    canDrop,
    currentPlaced,
    onDrop,
    onDropAtPosition,
    canDropAtPosition,
  };
}

export { createDropMetricsSession };
