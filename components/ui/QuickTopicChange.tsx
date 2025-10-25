"use client";
import OctopathDockButton from "@/components/ui/OctopathDockButton";
import { notify } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { topicControls } from "@/lib/game/service";
import { topicTypeLabels } from "@/lib/topics";
import type { RoomDoc } from "@/lib/types";
import { Menu, Text, VStack } from "@chakra-ui/react";
import { ChevronDown, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

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

  const triggerLabel = useMemo(
    () => (currentTopic ? "お題変更" : "お題を選択"),
    [currentTopic]
  );

  const triggerSubLabel = useMemo(
    () =>
      currentTopic && currentTopicBox
        ? `${currentTopicBox}`
        : currentTopic
        ? currentTopic
        : "カテゴリを選択",
    [currentTopic, currentTopicBox]
  );

  const handleCategorySelect = async (category: string) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await topicControls.selectCategory(roomId, category as any);
      notify({
        id: toastIds.topicChangeSuccess(roomId),
        title: `お題変更: ${category}`,
        type: "success",
        duration: 2000,
      });
    } catch (error: any) {
      notify({
        id: toastIds.topicError(roomId),
        title: "お題変更に失敗",
        description: error?.message,
        type: "error",
        duration: 3200,
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

  if (variant === "button") {
    return (
      <VStack gap={2} align="stretch">
        {currentTopic && (
          <OctopathDockButton
            onClick={handleShuffle}
            isLoading={isLoading}
            disabled={!currentTopicBox}
            icon={<RefreshCw size={16} />}
            label="お題をシャッフル"
            subLabel={currentTopic || undefined}
          />
        )}
        <Menu.Root>
          <Menu.Trigger asChild>
            <OctopathDockButton
              label={triggerLabel}
              subLabel={triggerSubLabel}
              icon={<ChevronDown size={14} />}
              isLoading={isLoading}
              disabled={isLoading}
            />
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
        <OctopathDockButton
          label={triggerLabel}
          subLabel={triggerSubLabel}
          icon={<ChevronDown size={14} />}
          isLoading={isLoading}
          disabled={isLoading}
          minW="220px"
        />
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
