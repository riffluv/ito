"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { topicControls } from "@/lib/game/topicControls";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { Shuffle, AlertTriangle } from "lucide-react";
import { useState } from "react";

export type QuickNumberRedealProps = {
  roomId: string;
  room: RoomDoc & { id?: string };
  players: (PlayerDoc & { id: string })[];
  onlineCount?: number;
  size?: "sm" | "md" | "lg";
};

export function QuickNumberRedeal({ 
  roomId, 
  room,
  players, 
  onlineCount = 0, 
  size = "sm" 
}: QuickNumberRedealProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const MIN_PLAYERS_FOR_DEAL = 2;
  const effectivePlayerCount = onlineCount || players.length;
  const tooFewPlayers = effectivePlayerCount < MIN_PLAYERS_FOR_DEAL;
  const topicSelected = !!(room as any)?.topic;
  
  // Check if numbers are already dealt
  const numbersDealt = players.some(p => typeof p.number === 'number');
  
  const canRedeal = topicSelected && !tooFewPlayers;

  const playCardDeal = useSoundEffect("card_deal");

  const handleRedeal = async () => {
    if (isLoading || !canRedeal) return;
    
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

  const getButtonText = () => {
    return "🎯";
  };

  const getButtonVariant = (): "solid" | "outline" | "ghost" | "subtle" | "surface" | "plain" => {
    if (!canRedeal) return "ghost";
    return numbersDealt ? "ghost" : "ghost";
  };

  const getIcon = () => {
    if (!canRedeal) return <AlertTriangle size={14} />;
    return <Shuffle size={14} />;
  };

  return (
    <AppButton
      onClick={handleRedeal}
      variant={getButtonVariant()}
      colorPalette={canRedeal ? "orange" : "gray"}
      size="sm"
      loading={isLoading}
      disabled={!canRedeal}
      title={
        !canRedeal 
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
    >
      {getButtonText()}
    </AppButton>
  );
}
