import { notify } from "@/components/ui/notify";
import {
  addCardToProposal,
  addCardToProposalAtPosition,
} from "@/lib/game/room";
import type { PlayerDoc } from "@/lib/types";
import { useMemo, useState } from "react";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";

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
  const [pending, setPending] = useState<string[]>([]);
  const [isOver, setIsOver] = useState(false);

  const canDrop = useMemo(() => {
    if (roomStatus !== "clue") return false;
    if (!hasNumber) return false;
    const ready = !!(me && typeof me.clue1 === "string" && me.clue1.trim());
    // 連想ワード未確定時は中央ボードへの提出を無効化（視覚的チラつき防止）
    if (!ready) return false;
    return true;
  }, [roomStatus, hasNumber, me?.clue1]);

  // Sort-submit mode only: position dropping always allowed
  const canDropAtPosition = useMemo(() => {
    return (targetIndex: number) => {
      return canDrop; // Always allow dropping at any position in sort-submit mode
    };
  }, [canDrop]);

  const currentPlaced = useMemo(() => {
    const base = orderList || [];
    const extra = pending.filter((id) => !base.includes(id));
    return [...base, ...extra];
  }, [orderList?.join(","), pending.join(",")]);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const pid = e.dataTransfer.getData("text/plain");
    if (!pid) return;

    setIsOver(false);

    if (!canDrop) {
      playDropInvalid();
      notify({ title: "今はここに置けません", type: "info" });
      return;
    }

    if (pid !== meId) {
      playDropInvalid();
      notify({ title: "自分のカードをドラッグしてください", type: "info" });
      return;
    }

    if (!me || typeof me.number !== "number") {
      playDropInvalid();
      notify({ title: "数字が割り当てられていません", type: "warning" });
      return;
    }

    // Only sort-submit mode is supported
    try {
      const result = await addCardToProposal(roomId, meId);
      if (result === "noop") {
        notify({
          title: "カードは既に提出済みです",
          type: "info",
        });
        return;
      }
      setPending((p) => (p.includes(pid) ? p : [...p, pid]));
      playCardPlace();
      notify({ title: "カードを場に置きました", type: "success" });
    } catch (err: any) {
      playDropInvalid();
      notify({
        title: "配置に失敗しました",
        description: err?.message,
        type: "error",
      });
    }
  };

  // Sort-submit mode: position drop handler (simplified)
  const onDropAtPosition = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const pid = e.dataTransfer.getData("text/plain");
    if (!pid) return;

    setIsOver(false);

    if (!canDrop) {
      playDropInvalid();
      notify({ title: "今はここに置けません", type: "info" });
      return;
    }

    if (pid !== meId) {
      playDropInvalid();
      notify({ title: "自分のカードをドラッグしてください", type: "info" });
      return;
    }

    if (!me || typeof me.number !== "number") {
      playDropInvalid();
      notify({ title: "数字が割り当てられていません", type: "warning" });
      return;
    }

    // 位置指定追加に切り替え
    let previous: string[] | null = null;
    try {
      // Optimistic update at target index
      setPending((prev) => {
        previous = prev.slice();
        const next = [...prev];
        const exist = next.indexOf(pid);
        if (exist >= 0) next.splice(exist, 1);
        if (targetIndex >= next.length) next.length = targetIndex + 1;
        next[targetIndex] = pid;
        return next;
      });
      const result = await addCardToProposalAtPosition(roomId, meId, targetIndex);
      if (result === "noop") {
        setPending(previous ?? []);
        notify({
          title: "その位置には置けません",
          description: "別の位置を選ぶか、既存のカードを動かしてください。",
          type: "info",
        });
        return;
      }
      playCardPlace();
      notify({ title: "カードをその位置に置きました", type: "success" });
    } catch (err: any) {
      if (previous !== null) {
        setPending(previous);
      }
      playDropInvalid();
      notify({
        title: "配置に失敗しました",
        description: err?.message,
        type: "error",
      });
    }
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
