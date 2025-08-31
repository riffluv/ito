import { useState, useMemo } from "react";
import { notify } from "@/components/ui/notify";
import { addCardToProposal, commitPlayFromClue } from "@/lib/game/room";
import type { PlayerDoc } from "@/lib/types";

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
    if (!hasNumber || mePlaced) return false;
    if (resolveMode === "sort-submit") return true;
    // 順次モード: 全員がready（cluesReady）になってから初めて出せる
    return !!cluesReady;
  }, [roomStatus, hasNumber, mePlaced, resolveMode, cluesReady]);

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
    
    if (resolveMode === "sort-submit") {
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
      return;
    }
    
    if (!cluesReady) {
      notify({
        title: "全員が連想ワードを決定してから出してください",
        type: "info",
      });
      return;
    }
    
    try {
      await commitPlayFromClue(roomId, meId);
      setPending((p) => (p.includes(pid) ? p : [...p, pid]));
      notify({ title: "カードを場に置きました（判定実行）", type: "success" });
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
  };
}
