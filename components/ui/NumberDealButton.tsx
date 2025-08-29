"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { topicControls } from "@/lib/game/topicControls";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { Shuffle } from "lucide-react";
import { useState } from "react";

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

  const handleDeal = async () => {
    if (isLoading || !canDeal) return;
    
    if (!topicSelected) {
      notify({ 
        title: "先にお題を設定してください", 
        type: "warning" 
      });
      return;
    }

    if (tooFewPlayers) {
      notify({ 
        title: `プレイヤーは${MIN_PLAYERS_FOR_DEAL}人以上必要です`, 
        type: "warning" 
      });
      return;
    }

    setIsLoading(true);
    try {
      await topicControls.dealNumbers(roomId);
      notify({ 
        title: numbersDealt ? "数字を配り直しました" : "数字を配布しました", 
        description: `${effectivePlayerCount}人に新しい数字を配布`,
        type: "success",
        duration: 3000,
      });
    } catch (error: any) {
      notify({
        title: "数字配布に失敗",
        description: error?.message,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppButton
      onClick={handleDeal}
      variant="ghost"
      size={size}
      loading={isLoading}
      disabled={!canDeal}
      title={
        !canDeal 
          ? (!topicSelected 
              ? "数字配布: 先にお題を選択してください" 
              : `数字配布: プレイヤーは${MIN_PLAYERS_FOR_DEAL}人以上必要です`
            )
          : numbersDealt 
            ? "数字を配り直す"
            : "数字を配布"
      }
      px={2}
      minW="auto"
      colorPalette={canDeal ? "orange" : "gray"}
    >
      <Shuffle size={14} />
    </AppButton>
  );
}