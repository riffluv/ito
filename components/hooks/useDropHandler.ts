import { notify } from "@/components/ui/notify";
import { isSortSubmit, normalizeResolveMode } from "@/lib/game/resolveMode";
import { addCardToProposal, commitPlayFromClue } from "@/lib/game/room";
import type { PlayerDoc } from "@/lib/types";
import { useMemo, useState } from "react";

interface UseDropHandlerProps {
  roomId: string;
  meId: string;
  me: (PlayerDoc & { id: string }) | undefined;
  roomStatus?: string;
  resolveMode?: string;
  cluesReady?: boolean;
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
  resolveMode,
  cluesReady,
  orderList,
  proposal,
  hasNumber,
  mePlaced,
}: UseDropHandlerProps) {
  const [pending, setPending] = useState<string[]>([]);
  const [isOver, setIsOver] = useState(false);

  const canDrop = useMemo(() => {
    if (roomStatus !== "clue") return false;
    if (!hasNumber) return false;
    
    // アニメーション期間中でも配置を許可（mePlaced チェックを緩和）
    const mode = normalizeResolveMode(resolveMode);
    if (isSortSubmit(mode)) return true; // 提出は常時可（ヒント確定前はUI側で制御可能）
    
    // 順次モードでは、既に配置済みの場合のみ制限
    if (mePlaced && !(orderList || []).includes(meId)) {
      // pending状態の場合は再配置を許可
      return true;
    }
    
    // 連想ワードの準備状況をより寛容にチェック
    return !!cluesReady;
  }, [roomStatus, hasNumber, mePlaced, resolveMode, cluesReady, meId, orderList]);

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
      notify({ title: "今はここに置けません", type: "info" });
      return;
    }

    if (pid !== meId) {
      notify({ title: "自分のカードをドラッグしてください", type: "info" });
      return;
    }

    if (!me || typeof me.number !== "number") {
      notify({ title: "数字が割り当てられていません", type: "warning" });
      return;
    }

    // Only sort-submit mode is supported
    try {
      await addCardToProposal(roomId, meId);
      setPending((p) => (p.includes(pid) ? p : [...p, pid]));
      notify({ title: "カードを場に置きました", type: "success" });
    } catch (err: any) {
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
      notify({ title: "今はここに置けません", type: "info" });
      return;
    }

    if (pid !== meId) {
      notify({ title: "自分のカードをドラッグしてください", type: "info" });
      return;
    }

    if (!me || typeof me.number !== "number") {
      notify({ title: "数字が割り当てられていません", type: "warning" });
      return;
    }

    // Only sort-submit mode is supported
    try {
      await addCardToProposal(roomId, meId);
      setPending((p) => (p.includes(pid) ? p : [...p, pid]));
      notify({ title: "カードを場に置きました", type: "success" });
    } catch (err: any) {
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
