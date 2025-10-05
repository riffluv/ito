"use client";
import { notify } from "@/components/ui/notify";
import OctopathDockButton from "@/components/ui/OctopathDockButton";
import { toastIds } from "@/lib/ui/toastIds";
import { topicControls } from "@/lib/game/topicControls";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { Shuffle } from "lucide-react";
import { useMemo, useState } from "react";

export type NumberDealButtonProps = {
  roomId: string;
  room: RoomDoc & { id?: string };
  players: (PlayerDoc & { id: string })[];
  onlineCount?: number;
  size?: "sm" | "md" | "lg";
};

export function NumberDealButton({ 
  roomId, 
  room,
  players, 
  onlineCount = 0, 
  size = "sm" 
}: NumberDealButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const MIN_PLAYERS_FOR_DEAL = 2;
  const effectivePlayerCount = onlineCount || players.length;
  const tooFewPlayers = effectivePlayerCount < MIN_PLAYERS_FOR_DEAL;
  const topicSelected = !!(room as any)?.topic;
  
  // Check if numbers are already dealt
  const numbersDealt = players.some(p => typeof p.number === 'number');
  
  const canDeal = topicSelected && !tooFewPlayers;

  const playCardDeal = useSoundEffect("card_deal");
  const effectivelyLoading = isLoading;

  const subLabel = useMemo(() => {
    if (!topicSelected) return "お題未設定";
    if (effectivelyLoading) return "処理中";
    return numbersDealt ? "配り直し" : `${effectivePlayerCount}人に配布`;
  }, [topicSelected, effectivelyLoading, numbersDealt, effectivePlayerCount]);

  const handleDeal = async () => {
    if (isLoading || !canDeal) return;
    
    if (!topicSelected) {
      notify({ 
        id: toastIds.numberDealWarningNoTopic(roomId),
        title: "先にお題を設定してください", 
        type: "warning",
        duration: 2200,
      });
      return;
    }

    if (tooFewPlayers) {
      notify({ 
        id: toastIds.numberDealWarningPlayers(roomId),
        title: `プレイヤーは${MIN_PLAYERS_FOR_DEAL}人以上必要です`, 
        type: "warning",
        duration: 2200,
      });
      return;
    }

    setIsLoading(true);
    try {
      playCardDeal();
      await topicControls.dealNumbers(roomId);
      notify({ 
        id: toastIds.numberDealSuccess(roomId),
        title: numbersDealt ? "数字を配り直しました" : "数字を配布しました",
        type: "success",
        duration: 2000,
      });
    } catch (error: any) {
      notify({
        id: toastIds.numberDealError(roomId),
        title: "数字配布に失敗",
        description: error?.message,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <OctopathDockButton
      onClick={handleDeal}
      isLoading={effectivelyLoading}
      disabled={!canDeal}
      label="数字配布"
      subLabel={subLabel}
      icon={<Shuffle size={16} />}
      title={
        !canDeal
          ? !topicSelected
            ? "数字配布: 先にお題を選択してください"
            : `数字配布: プレイヤーは${MIN_PLAYERS_FOR_DEAL}人以上必要です`
          : numbersDealt
          ? "数字を配り直す"
          : "数字を配布"
      }
      minW={size === "lg" ? "260px" : size === "md" ? "240px" : "220px"}
    />
  );
}
