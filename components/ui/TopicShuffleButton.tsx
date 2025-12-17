"use client";
import { notify } from "@/components/ui/notify";
import OctopathDockButton from "@/components/ui/OctopathDockButton";
import { toastIds } from "@/lib/ui/toastIds";
import { topicControls } from "@/lib/game/service";
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

  const currentTopic = room.topic ?? null;
  const currentTopicBox = room.topicBox ?? null;
  const currentCategory =
    currentTopicBox === "通常版" || currentTopicBox === "レインボー版" || currentTopicBox === "クラシック版"
      ? currentTopicBox
      : null;

  const handleShuffle = async () => {
    if (isLoading || !currentCategory) return;

    setIsLoading(true);
    try {
      await topicControls.shuffleTopic(roomId, currentCategory);
      notify({
        id: toastIds.topicShuffleSuccess(roomId),
        title: "お題をシャッフルしました",
        type: "success",
        duration: 2000,
      });
    } catch (error: unknown) {
      const description =
        error instanceof Error ? error.message : String(error ?? "unknown");
      notify({
        id: toastIds.topicError(roomId),
        title: "シャッフルに失敗",
        description,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canShuffle = Boolean(currentTopic && currentCategory);

  return (
    <OctopathDockButton
      onClick={handleShuffle}
      isLoading={isLoading}
      disabled={!canShuffle}
      label="お題シャッフル"
      subLabel={currentTopic ? currentTopic : "カテゴリ未選択"}
      icon={<RefreshCw size={16} />}
      title={
        canShuffle
          ? `お題をシャッフル (現在: ${currentTopic})`
          : "お題を選択してからシャッフルできます"
      }
      minW={size === "lg" ? "240px" : size === "md" ? "220px" : "210px"}
    />
  );
}
