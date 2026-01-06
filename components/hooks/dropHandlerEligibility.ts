import { notify } from "@/components/ui/notify";
import type { PlayerDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import { useCallback, useMemo } from "react";

export type DropOutcome = "success" | "noop" | "error";

export type DropValidationResult =
  | { ok: true }
  | {
      ok: false;
      outcome: DropOutcome;
      reason?: string;
    };

export type DropEligibilityOptions = {
  roomStatus?: string;
  hasNumber: boolean;
  presenceReady: boolean;
  me: (PlayerDoc & { id: string }) | undefined;
  meId: string;
  roomId: string;
  playInvalidSound: () => void;
  dealReady: boolean;
  dealGuardActive: boolean;
  interactionEnabled: boolean;
};

export function useDropEligibility({
  roomStatus,
  hasNumber,
  presenceReady,
  me,
  meId,
  roomId,
  playInvalidSound,
  dealReady,
  dealGuardActive,
  interactionEnabled,
}: DropEligibilityOptions): {
  canDrop: boolean;
  ensureCanDrop: (pid: string) => DropValidationResult;
} {
  const hasClueText = useMemo(() => {
    if (typeof me?.clue1 !== "string") return false;
    return me.clue1.trim().length > 0;
  }, [me?.clue1]);

  const canDrop = useMemo(() => {
    if (!interactionEnabled) return false;
    if (roomStatus !== "clue") return false;
    if (!presenceReady) return false;
    if (!hasNumber) return false;
    if (!dealReady) return false;
    if (dealGuardActive) return false;
    if (!hasClueText) return false;
    return true;
  }, [
    interactionEnabled,
    roomStatus,
    presenceReady,
    hasNumber,
    dealReady,
    hasClueText,
    dealGuardActive,
  ]);

  const ensureCanDrop = useCallback(
    (pid: string): DropValidationResult => {
      if (!interactionEnabled) {
        traceAction("interaction.drop.blocked", {
          roomId,
          playerId: meId,
          reason: "readonly-tab",
        });
        playInvalidSound();
        notify({
          id: `${roomId}-readonly-tab`,
          title: "別タブで操作中",
          description: "操作する場合はアクティブなタブに切り替えてください。",
          type: "info",
          duration: 1600,
        });
        return { ok: false, outcome: "error", reason: "readonly-tab" };
      }
      if (dealGuardActive) {
        traceAction("interaction.drop.blocked", {
          roomId,
          playerId: meId,
          reason: "deal-guard",
        });
        playInvalidSound();
        notify({
          id: `${roomId}-deal-guard`,
          title: "配札を待っています",
          description: "数字配布が終わるまでカードは動かせません。",
          type: "info",
          duration: 1800,
        });
        return { ok: false, outcome: "error", reason: "deal-guard" };
      }

      if (!presenceReady) {
        traceAction("interaction.drop.blocked", {
          roomId,
          playerId: meId,
          reason: "presence-sync",
        });
        playInvalidSound();
        notify({
          id: `${roomId}-presence-sync`,
          title: "再接続中…",
          description: "接続が安定してからカードを動かしてください。",
          type: "info",
          duration: 1400,
        });
        return { ok: false, outcome: "error", reason: "presence-sync" };
      }

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
        return { ok: false, outcome: "error", reason: "deal-pending" };
      }

      if (!canDrop) {
        traceAction("interaction.drop.blocked", {
          roomId,
          playerId: meId,
          reason: "phase",
        });
        playInvalidSound();
        notify({ title: "今はここに置けません", type: "info" });
        return { ok: false, outcome: "error", reason: "phase" };
      }

      if (pid !== meId) {
        traceAction("interaction.drop.blocked", {
          roomId,
          playerId: meId,
          reason: "foreign-card",
        });
        playInvalidSound();
        notify({ title: "自分のカードをドラッグしてください", type: "info" });
        return { ok: false, outcome: "error", reason: "foreign-card" };
      }

      if (!me || typeof me.number !== "number") {
        traceAction("interaction.drop.blocked", {
          roomId,
          playerId: meId,
          reason: "no-number",
        });
        playInvalidSound();
        notify({ title: "数字が割り当てられていません", type: "warning" });
        return { ok: false, outcome: "error", reason: "no-number" };
      }

      return { ok: true };
    },
    [
      canDrop,
      dealGuardActive,
      dealReady,
      interactionEnabled,
      me,
      meId,
      playInvalidSound,
      roomId,
      presenceReady,
    ]
  );

  return { canDrop, ensureCanDrop };
}

