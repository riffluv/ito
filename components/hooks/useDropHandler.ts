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

const DROP_OPTIMISTIC_ENABLED = process.env.NEXT_PUBLIC_UI_DROP_OPTIMISTIC === "1";

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
}

export function useDropHandler({
  roomId,
  meId,
  me,
  roomStatus,
  orderList,
  proposal,
  hasNumber,
  mePlaced,
}: UseDropHandlerProps) {
  const playCardPlace = useSoundEffect("card_place");
  const playDropInvalid = useSoundEffect("drop_invalid");
  const soundManager = useSoundManager();
  const prewarmRoomRef = useRef<string | null>(null);
  const dropSoundReady = useRef(false);
  const [pending, setPending] = useState<string[]>([]);
  const [isOver, setIsOver] = useState(false);
  const optimisticMode = DROP_OPTIMISTIC_ENABLED;

  useEffect(() => {
    if (!soundManager) return;
    if (!roomId) return;
    if (prewarmRoomRef.current === roomId && dropSoundReady.current) return;
    const targetRoom = roomId;
    prewarmRoomRef.current = targetRoom;
    const dropSoundIds: SoundId[] = ["card_place", "drop_success", "drop_invalid", "drag_pickup"];
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

  const playCardPlaceNow = useCallback(() => {
    if (soundManager) {
      soundManager.markUserInteraction();
      void soundManager.prepareForInteraction();
    }
    playCardPlace();
  }, [soundManager, playCardPlace]);

  const playDropInvalidNow = useCallback(() => {
    if (soundManager) {
      soundManager.markUserInteraction();
      void soundManager.prepareForInteraction();
    }
    playDropInvalid();
  }, [soundManager, playDropInvalid]);

  const canDrop = useMemo(() => {
    if (roomStatus !== "clue") return false;
    if (!hasNumber) return false;
    const ready = !!(me && typeof me.clue1 === "string" && me.clue1.trim());
    if (!ready) return false;
    return true;
  }, [roomStatus, hasNumber, me?.clue1]);

  const canDropAtPosition = useMemo(() => {
    return (targetIndex: number) => {
      return canDrop;
    };
  }, [canDrop]);

  const currentPlaced = useMemo(() => {
    const base = orderList || [];
    const extra = pending.filter((id) => !base.includes(id));
    return [...base, ...extra];
  }, [orderList?.join(","), pending.join(",")]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const pid = e.dataTransfer.getData("text/plain");
    if (!pid) return;

    setIsOver(false);

    const startedAt = typeof performance !== "undefined" ? performance.now() : null;
    const optimistic = optimisticMode;
    const logOutcome = (outcome: DropOutcome) => {
      if (startedAt === null || typeof performance === "undefined") return;
      const sample = Number(Math.max(0, performance.now() - startedAt).toFixed(2));
      if (!Number.isFinite(sample)) return;
      recordMetricDistribution("client.drop.resolveMs", sample, {
        outcome,
        mode: optimistic ? "optimistic" : "default",
      });
    };

    if (!canDrop) {
      traceAction("interaction.drop.blocked", {
        roomId,
        playerId: meId,
        reason: "phase",
      });
      playDropInvalidNow();
      notify({ title: "今はここに置けません", type: "info" });
      return;
    }

    if (pid !== meId) {
      traceAction("interaction.drop.blocked", {
        roomId,
        playerId: meId,
        reason: "foreign-card",
      });
      playDropInvalidNow();
      notify({ title: "自分のカードをドラッグしてください", type: "info" });
      return;
    }

    if (!me || typeof me.number !== "number") {
      traceAction("interaction.drop.blocked", {
        roomId,
        playerId: meId,
        reason: "no-number",
      });
      playDropInvalidNow();
      notify({ title: "数字が割り当てられていません", type: "warning" });
      return;
    }

    let previousPending: string[] | null = null;
    let inserted = false;
    let didPlaySound = false;
    const playOnce = () => {
      if (didPlaySound) return;
      didPlaySound = true;
      playCardPlaceNow();
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

    traceAction("interaction.drop.commit", {
      roomId,
      playerId: meId,
      target: "board",
      optimistic,
      placed: inserted,
    });

    if (optimistic && inserted) {
      notify({ title: "カードを場に置きました", type: "success" });
      notifiedSuccess = true;
    }

    const request = addCardToProposal(roomId, meId);
    if (inserted) {
      playOnce();
    }

    request
      .then((result) => {
        if (result === "noop") {
          logOutcome("noop");
          if (inserted && previousPending) {
            const snapshot = previousPending.slice();
            setPending(() => snapshot);
          }
          traceAction("interaction.drop.noop", {
            roomId,
            playerId: meId,
          });
          playDropInvalidNow();
          notify({
            title: "カードは既に提出済みです",
            type: "info",
          });
          return;
        }
        logOutcome("success");
        traceAction("interaction.drop.success", {
          roomId,
          playerId: meId,
          optimistic,
        });
        if (!notifiedSuccess) {
          notify({ title: "カードを場に置きました", type: "success" });
        }
      })
      .catch((err: any) => {
        logOutcome("error");
        traceError("interaction.drop.error", err, {
          roomId,
          playerId: meId,
        });
        if (previousPending && inserted) {
          const snapshot = previousPending.slice();
          setPending(() => snapshot);
        }
        playDropInvalidNow();
        notify({
          title: "配置に失敗しました",
          description: err?.message,
          type: "error",
        });
      });
  };

  const onDropAtPosition = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const pid = e.dataTransfer.getData("text/plain");
    if (!pid) return;

    setIsOver(false);

    const startedAt = typeof performance !== "undefined" ? performance.now() : null;
    const optimistic = optimisticMode;
    const logOutcome = (outcome: DropOutcome) => {
      if (startedAt === null || typeof performance === "undefined") return;
      const sample = Number(Math.max(0, performance.now() - startedAt).toFixed(2));
      if (!Number.isFinite(sample)) return;
      recordMetricDistribution("client.drop.resolveMs", sample, {
        outcome,
        mode: optimistic ? "optimistic" : "default",
      });
    };

    if (!canDrop) {
      traceAction("interaction.drop.blocked", {
        roomId,
        playerId: meId,
        reason: "phase",
      });
      playDropInvalidNow();
      notify({ title: "今はここに置けません", type: "info" });
      return;
    }

    if (pid !== meId) {
      traceAction("interaction.drop.blocked", {
        roomId,
        playerId: meId,
        reason: "foreign-card",
      });
      playDropInvalidNow();
      notify({ title: "自分のカードをドラッグしてください", type: "info" });
      return;
    }

    if (!me || typeof me.number !== "number") {
      traceAction("interaction.drop.blocked", {
        roomId,
        playerId: meId,
        reason: "no-number",
      });
      playDropInvalidNow();
      notify({ title: "数字が割り当てられていません", type: "warning" });
      return;
    }

    let previous: string[] | null = null;
    let inserted = false;
    let didPlaySound = false;
    const playOnce = () => {
      if (didPlaySound) return;
      didPlaySound = true;
      playCardPlaceNow();
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

    traceAction("interaction.drop.commit", {
      roomId,
      playerId: meId,
      target: "position",
      index: targetIndex,
      optimistic,
      placed: inserted,
    });

    if (optimistic && inserted) {
      notify({ title: "カードを場に置きました", type: "success" });
      notifiedSuccess = true;
    }

    const request = scheduleAddCardToProposalAtPosition(roomId, meId, targetIndex);
    if (inserted) {
      playOnce();
    }

    request
      .then((result) => {
        if (result === "noop") {
          logOutcome("noop");
          if (inserted) {
            const snapshot = previous ? previous.slice() : [];
            setPending(() => snapshot);
          }
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
          playDropInvalidNow();
          return;
        }

        logOutcome("success");
        traceAction("interaction.drop.success", {
          roomId,
          playerId: meId,
          optimistic,
          index: targetIndex,
        });
        if (!notifiedSuccess) {
          notify({ title: "カードをその位置に置きました", type: "success" });
        }
      })
      .catch((err: any) => {
        logOutcome("error");
        traceError("interaction.drop.error", err, {
          roomId,
          playerId: meId,
          index: targetIndex,
        });
        if (previous && inserted) {
          const snapshot = previous.slice();
          setPending(() => snapshot);
        }
        notify({
          title: "配置に失敗しました",
          description: err?.message,
          type: "error",
        });
        playDropInvalidNow();
      });
  };

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
