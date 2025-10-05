"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { topicControls } from "@/lib/game/topicControls";
import type { RoomDoc } from "@/lib/types";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

export type TopicShuffleButtonProps = {
  roomId: string;
  room: RoomDoc & { id?: string };
  size?: "sm" | "md" | "lg";
};

export function TopicShuffleButton({
  roomId,
  room,
  size = "sm",
}: TopicShuffleButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const currentTopic = (room as any)?.topic;
  const currentTopicBox = (room as any)?.topicBox;

  const handleShuffle = async () => {
    if (isLoading || !currentTopicBox) return;

    setIsLoading(true);
    try {
      await topicControls.shuffleTopic(roomId, currentTopicBox);
      notify({
        id: toastIds.topicShuffleSuccess(roomId),
        title: "お題をシャッフルしました",
        type: "success",
        duration: 2000,
      });
    } catch (error: any) {
      notify({
        id: toastIds.topicError(roomId),
        title: "シャッフルに失敗",
        description: error?.message,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canShuffle = currentTopic && currentTopicBox;

  return (
    <AppButton
      onClick={handleShuffle}
      variant="ghost"
      size={size}
      loading={isLoading}
      disabled={!canShuffle}
      title={
        canShuffle
          ? `お題をシャッフル (現在: ${currentTopic})`
          : "お題を選択してからシャッフルできます"
      }
      px={2}
      minW="auto"
      colorPalette={canShuffle ? "teal" : "gray"}
    >
      <RefreshCw size={14} />
    </AppButton>
  );
}
