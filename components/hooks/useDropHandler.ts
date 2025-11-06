import { notify } from "@/components/ui/notify";
import { scheduleAddCardToProposalAtPosition } from "@/lib/game/proposalScheduler";
import { addCardToProposal } from "@/lib/game/service";
import type { PlayerDoc } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { useSoundManager } from "@/lib/audio/SoundProvider";
import type { SoundId } from "@/lib/audio/types";
import { traceAction, traceError } from "@/lib/utils/trace";
import { recordMetricDistribution } from "@/lib/perf/metricsClient";
import { setMetric } from "@/lib/utils/metrics";

export const DROP_OPTIMISTIC_ENABLED =
  process.env.NEXT_PUBLIC_UI_DROP_OPTIMISTIC === "1";

const OPTIMISTIC_ROLLBACK_MS = 1200;

type DropOutcome = "success" | "noop" | "error";

interface UseDropHandlerProps {
  roomId: string;
  meId: string;
  me: (PlayerDoc & { id: string }) | undefined;
  roomStatus?: string;
  orderList?: string[];
  proposal?: string[];
  hasNumber: boolean;
  mePlaced: boolean;
  dealReady: boolean;
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
}: UseDropHandlerProps) {
  const soundManager = useSoundManager();
  const { playSuccessSound, playInvalidSound } = useDropSounds(roomId);
  const { canDrop, ensureCanDrop } = useDropEligibility({
    roomStatus,
    hasNumber,
    me,
    meId,
    roomId,
    playInvalidSound,
    dealReady,
  });

  const [pending, setPending] = useState<(string | null)[]>([]);
  const [isOver, setIsOver] = useState(false);
  const optimisticMode = DROP_OPTIMISTIC_ENABLED;
  const proposalSignature = useMemo(
    () =>
      Array.isArray(_proposal)
        ? _proposal.map((id) => (typeof id === "string" ? id : "_")).join(",")
        : "none",
    [_proposal]
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
    if (process.env.NEXT_PUBLIC_AUDIO_RESUME_ON_POINTER !== "1") return;
    if (typeof window === "undefined") return;
    if (!soundManager) return;

    if (roomStatus !== "clue") {
      pointerUnlockArmedRef.current = false;
      pointerUnlockDoneRef.current = false;
      return;
    }
    if (pointerUnlockDoneRef.current || pointerUnlockArmedRef.current) return;

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
    if (Array.isArray(_proposal)) {
      const sanitized = _proposal.filter(
        (id): id is string => typeof id === "string" && id.length > 0
      );
      latestProposalRef.current = sanitized;
    } else {
      latestProposalRef.current = [];
    }
  }, [proposalSignature]);

  useEffect(() => {
    if (!optimisticMode) return;
    if (latestProposalRef.current.length === 0) return;
    setPending((prev) => {
      if (prev.length === 0) return prev;
      const proposalSet = new Set(latestProposalRef.current);
      let changed = false;
      const next = prev.slice();
      for (let idx = 0; idx < next.length; idx += 1) {
        const value = next[idx];
        if (typeof value === "string" && proposalSet.has(value)) {
          next[idx] = null;
          changed = true;
          clearOptimisticEntry(value);
        }
      }
      if (!changed) return prev;
      while (next.length > 0 && next[next.length - 1] == null) {
        next.pop();
      }
      return next;
    });
  }, [clearOptimisticEntry, optimisticMode, proposalSignature, setPending]);

  useEffect(() => {
    return () => {
      optimisticEntriesRef.current.forEach((entry) => {
        if (entry.timer) {
          clearTimeout(entry.timer);
        }
      });
      optimisticEntriesRef.current.clear();
    };
  }, []);

  const canDropAtPosition = useMemo(() => {
    return (_targetIndex: number) => canDrop;
  }, [canDrop]);

  const currentPlaced = useMemo(() => {
    const base = orderList || [];
    const pendingIds = pending.filter(
      (id): id is string => typeof id === "string" && id.length > 0
    );
    const extra = pendingIds.filter((id) => !base.includes(id));
    return [...base, ...extra];
  }, [
    orderList?.join(","),
    pending.map((id) => id ?? "_").join(","),
  ]);

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
        return;
      }

      let previousPending: (string | null)[] = [];
      let inserted = false;
      let didPlaySound = false;
      let stageNotifyMarked = false;
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
      let notifiedSuccess = false;

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

      if (optimisticMode && inserted) {
        notify({ title: "カードを場に置きました", type: "success" });
        notifiedSuccess = true;
        if (!stageNotifyMarked) {
          stageNotifyMarked = true;
          session.markStage("client.drop.t1_notifyShownMs", { origin: "optimistic" });
        }
      }

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
            return;
          }
          session.complete("success");
          traceAction("interaction.drop.success", {
            roomId,
            playerId: meId,
            optimistic: optimisticMode,
          });
          if (!notifiedSuccess) {
            notify({ title: "カードを場に置きました", type: "success" });
            if (!stageNotifyMarked) {
              stageNotifyMarked = true;
              session.markStage("client.drop.t1_notifyShownMs", { origin: "post" });
            }
          }
        })
        .catch((err: any) => {
          if (!stageResolutionMarked) {
            stageResolutionMarked = true;
            session.markStage("client.drop.t2_addProposalResolvedMs", { result: "error" });
          }
          session.complete("error");
          traceError("interaction.drop.error", err, {
            roomId,
            playerId: meId,
          });
          if (inserted) {
            const snapshot = previousPending.slice();
            setPending(() => snapshot);
          }
          clearOptimisticEntry(pid);
          playInvalidSound();
          notify({
            title: "配置に失敗しました",
            description: err?.message,
            type: "error",
          });
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
        return;
      }

      let previous: (string | null)[] = [];
      let inserted = false;
      let didPlaySound = false;
      let stageNotifyMarked = false;
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
      let notifiedSuccess = false;

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

      if (optimisticMode && inserted) {
        notify({ title: "カードを場に置きました", type: "success" });
        notifiedSuccess = true;
        if (!stageNotifyMarked) {
          stageNotifyMarked = true;
          session.markStage("client.drop.t1_notifyShownMs", {
            origin: "optimistic",
            index: String(targetIndex),
          });
        }
      }

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
            return;
          }

          session.complete("success");
          traceAction("interaction.drop.success", {
            roomId,
            playerId: meId,
            optimistic: optimisticMode,
            index: targetIndex,
          });
          if (!notifiedSuccess) {
            notify({ title: "カードをその位置に置きました", type: "success" });
            if (!stageNotifyMarked) {
              stageNotifyMarked = true;
              session.markStage("client.drop.t1_notifyShownMs", {
                origin: "post",
                index: String(targetIndex),
              });
            }
          }
        })
        .catch((err: any) => {
          if (!stageResolutionMarked) {
            stageResolutionMarked = true;
            session.markStage("client.drop.t2_addProposalResolvedMs", {
              result: "error",
              index: String(targetIndex),
            });
          }
          session.complete("error");
          traceError("interaction.drop.error", err, {
            roomId,
            playerId: meId,
            index: targetIndex,
          });
          if (inserted) {
            const snapshot = previous.slice();
            setPending(() => snapshot);
          }
          clearOptimisticEntry(pid);
          notify({
            title: "配置に失敗しました",
            description: err?.message,
            type: "error",
          });
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

// --- helpers -----------------------------------------------------------------

function useDropSounds(roomId: string) {
  const playCardPlace = useSoundEffect("card_place");
  const playDropInvalid = useCallback(() => {}, []);
  const soundManager = useSoundManager();
  const prewarmRoomRef = useRef<string | null>(null);
  const dropSoundReady = useRef(false);

  useEffect(() => {
    if (!soundManager || !roomId) return;
    if (prewarmRoomRef.current === roomId && dropSoundReady.current) return;
    const targetRoom = roomId;
    prewarmRoomRef.current = targetRoom;
      const dropSoundIds: SoundId[] = ["card_place", "drop_success"];
    void soundManager
      .prewarm(dropSoundIds)
      .then(() => {
        if (prewarmRoomRef.current === targetRoom) {
          dropSoundReady.current = true;
        }
        traceAction("audio.prewarm.drop", { roomId: targetRoom });
      })
      .catch((error) => {
        if (prewarmRoomRef.current === targetRoom) {
          dropSoundReady.current = false;
        }
        traceError("audio.prewarm.drop.failed", error as any, { roomId: targetRoom });
      });
  }, [soundManager, roomId]);

  const ensureInteraction = useCallback(() => {
    if (!soundManager) return;
    soundManager.markUserInteraction();
    void soundManager.prepareForInteraction();
  }, [soundManager]);

  const playSuccessSound = useCallback(() => {
    ensureInteraction();
    playCardPlace();
  }, [ensureInteraction, playCardPlace]);

  const playInvalidSound = useCallback(() => {
    ensureInteraction();
    playDropInvalid();
  }, [ensureInteraction, playDropInvalid]);

  return { playSuccessSound, playInvalidSound };
}

type DropEligibilityOptions = {
  roomStatus?: string;
  hasNumber: boolean;
  me: (PlayerDoc & { id: string }) | undefined;
  meId: string;
  roomId: string;
  playInvalidSound: () => void;
  dealReady: boolean;
};

type DropValidationResult =
  | { ok: true }
  | {
      ok: false;
      outcome: DropOutcome;
    };

function useDropEligibility({
  roomStatus,
  hasNumber,
  me,
  meId,
  roomId,
  playInvalidSound,
  dealReady,
}: DropEligibilityOptions) {
  const canDrop = useMemo(() => {
    if (roomStatus !== "clue") return false;
    if (!hasNumber) return false;
    if (!dealReady) return false;
    const ready = !!(me && typeof me.clue1 === "string" && me.clue1.trim());
    if (!ready) return false;
    return true;
  }, [roomStatus, hasNumber, dealReady, me?.clue1]);

  const ensureCanDrop = useCallback(
    (pid: string): DropValidationResult => {
      if (!dealReady) {
        traceAction("interaction.drop.blocked", {
          roomId,
          playerId: meId,
          reason: "deal-pending",
        });
        playInvalidSound();
        notify({
          id: `${roomId}-deal-pending`,
          title: "配札を待っています",
          description: "数字の配布が終わるまでカードは動かせません。",
          type: "info",
          duration: 1800,
        });
        return { ok: false, outcome: "error" };
      }

      if (!canDrop) {
        traceAction("interaction.drop.blocked", {
          roomId,
          playerId: meId,
          reason: "phase",
        });
        playInvalidSound();
        notify({ title: "今はここに置けません", type: "info" });
        return { ok: false, outcome: "error" };
      }

      if (pid !== meId) {
        traceAction("interaction.drop.blocked", {
          roomId,
          playerId: meId,
          reason: "foreign-card",
        });
        playInvalidSound();
        notify({ title: "自分のカードをドラッグしてください", type: "info" });
        return { ok: false, outcome: "error" };
      }

      if (!me || typeof me.number !== "number") {
        traceAction("interaction.drop.blocked", {
          roomId,
          playerId: meId,
          reason: "no-number",
        });
        playInvalidSound();
        notify({ title: "数字が割り当てられていません", type: "warning" });
        return { ok: false, outcome: "error" };
      }

      return { ok: true };
    },
    [canDrop, dealReady, me, meId, playInvalidSound, roomId]
  );

  return { canDrop, ensureCanDrop };
}

export function createDropMetricsSession({
  optimisticMode,
  index,
}: {
  optimisticMode: boolean;
  index?: number;
}) {
  const startedAt = typeof performance !== "undefined" ? performance.now() : null;
  const baseTags: Record<string, string> = {
    mode: optimisticMode ? "optimistic" : "default",
  };
  if (typeof index === "number") {
    baseTags.index = String(index);
  }

  const storeDebugMetric = (name: string, value: number) => {
    const lastDot = name.lastIndexOf(".");
    if (lastDot <= 0) return;
    const scope = name.slice(0, lastDot);
    const key = name.slice(lastDot + 1);
    setMetric(scope, key, Number(value.toFixed(2)));
  };

  const computeSample = () => {
    if (startedAt === null || typeof performance === "undefined") return null;
    const sample = Number(Math.max(0, performance.now() - startedAt).toFixed(2));
    if (!Number.isFinite(sample)) return null;
    return sample;
  };

  const markStage = (metricId: string, extra?: Record<string, string>) => {
    const sample = computeSample();
    if (sample === null) return;
    recordMetricDistribution(metricId, sample, {
      ...baseTags,
      ...(extra ?? {}),
    });
    storeDebugMetric(metricId, sample);
  };

  const complete = (outcome: DropOutcome) => {
    const sample = computeSample();
    if (sample === null) return;
    recordMetricDistribution("client.drop.resolveMs", sample, {
      outcome,
      ...baseTags,
    });
    storeDebugMetric("client.drop.resolveMs", sample);
  };

  const abort = (outcome: DropOutcome) => {
    complete(outcome);
  };

  markStage("client.drop.t0_onDropStartMs");

  return {
    complete,
    abort,
    markStage,
  };
}
