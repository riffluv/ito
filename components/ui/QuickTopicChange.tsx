"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { topicControls } from "@/lib/game/topicControls";
import { topicTypeLabels } from "@/lib/topics";
import type { RoomDoc } from "@/lib/types";
import { Menu, Text, VStack } from "@chakra-ui/react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { useState } from "react";

export type QuickTopicChangeProps = {
  roomId: string;
  room: RoomDoc & { id?: string };
  variant?: "button" | "menu";
  size?: "sm" | "md" | "lg";
};

export function QuickTopicChange({
  roomId,
  room,
  variant = "menu",
  size = "sm",
}: QuickTopicChangeProps) {
  const [isLoading, setIsLoading] = useState(false);

  const currentTopic = (room as any)?.topic;
  const currentTopicBox = (room as any)?.topicBox;

  const handleCategorySelect = async (category: string) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await topicControls.selectCategory(roomId, category as any);
      notify({
        title: "お題を変更しました",
        description: `新しいカテゴリ: ${category}`,
        type: "success",
        duration: 3000,
      });
    } catch (error: any) {
      notify({
        title: "お題変更に失敗",
        description: error?.message,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleShuffle = async () => {
    if (isLoading || !currentTopicBox) return;

    setIsLoading(true);
    try {
      await topicControls.shuffleTopic(roomId, currentTopicBox);
      notify({
        title: "お題をシャッフルしました",
        type: "success",
        duration: 3000,
      });
    } catch (error: any) {
      notify({
        title: "シャッフルに失敗",
        description: error?.message,
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (variant === "button") {
    return (
      <VStack gap={2}>
        {currentTopic && (
          <AppButton
            onClick={handleShuffle}
            variant="outline"
            size={size}
            loading={isLoading}
          >
            <RefreshCw size={14} />
            お題をシャッフル
          </AppButton>
        )}
        <Menu.Root>
          <Menu.Trigger asChild>
            <AppButton variant="outline" size={size} loading={isLoading}>
              📝 お題変更
              <ChevronDown size={14} />
            </AppButton>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content>
              {topicTypeLabels.map((category) => (
                <Menu.Item
                  key={category}
                  value={category}
                  onSelect={() => handleCategorySelect(category)}
                >
                  {category}
                  {currentTopicBox === category && " ✓"}
                </Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      </VStack>
    );
  }

  // Menu variant (default)
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <AppButton
          variant="ghost"
          size="sm"
          loading={isLoading}
          title={currentTopic ? `お題変更 (現在: ${currentTopic})` : "お題を選択"}
          px={2}
          minW="auto"
        >
          📝
          <ChevronDown size={12} />
        </AppButton>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content>
          {currentTopic && currentTopicBox && (
            <>
              <Menu.Item value="shuffle" onSelect={handleShuffle}>
                🎲 同じカテゴリでシャッフル
              </Menu.Item>
              <Menu.Separator />
            </>
          )}

          <Text
            fontSize="xs"
            color="gray.600"
            px={3}
            py={1}
            fontWeight="medium"
          >
            カテゴリを選択
          </Text>

          {topicTypeLabels.map((category) => (
            <Menu.Item
              key={category}
              value={category}
              onSelect={() => handleCategorySelect(category)}
            >
              {category}
              {currentTopicBox === category && " ✓"}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}
