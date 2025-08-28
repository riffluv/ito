"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { topicControls } from "@/lib/game/topicControls";
import { topicTypeLabels } from "@/lib/topics";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { Box, Dialog, HStack, Text, VStack } from "@chakra-ui/react";
import { X } from "lucide-react";

export type AdvancedHostPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  room: RoomDoc & { id?: string };
  players: (PlayerDoc & { id: string })[];
  onlineCount?: number;
};

export function AdvancedHostPanel({
  isOpen,
  onClose,
  roomId,
  room,
  players,
  onlineCount = 0,
}: AdvancedHostPanelProps) {
  const MIN_PLAYERS_FOR_DEAL = 2;
  const topicSelected = !!(room as any)?.topic;
  const tooFewPlayers = onlineCount < MIN_PLAYERS_FOR_DEAL;

  const handleCategorySelect = async (category: string) => {
    try {
      await topicControls.selectCategory(roomId, category as any);
      onClose(); // 選択後は閉じる
    } catch (error: any) {
      notify({
        title: "カテゴリ選択に失敗",
        description: error?.message,
        type: "error",
      });
    }
  };

  const handleShuffle = async () => {
    try {
      await topicControls.shuffleTopic(roomId, ((room as any)?.topicBox as string) || null);
    } catch (error: any) {
      notify({
        title: "シャッフルに失敗",
        description: error?.message,
        type: "error",
      });
    }
  };

  const handleDealNumbers = async () => {
    try {
      if (!topicSelected) {
        notify({ title: "先にお題を設定してください", type: "warning" });
        return;
      }
      await topicControls.dealNumbers(roomId);
      notify({ title: "数字を配布しました", type: "success" });
    } catch (error: any) {
      notify({
        title: "数字配布に失敗",
        description: error?.message,
        type: "error",
      });
    }
  };

  const handleReselect = async () => {
    try {
      await topicControls.resetTopic(roomId);
    } catch (error: any) {
      notify({
        title: "お題リセットに失敗",
        description: error?.message,
        type: "error",
      });
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(d) => !d.open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxW="lg">
          <Dialog.Header>
            <HStack justify="space-between" w="100%">
              <Text fontSize="xl" fontWeight="bold">
                ⚙️ 詳細設定（上級者向け）
              </Text>
              <AppButton
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="閉じる"
              >
                <X size={16} />
              </AppButton>
            </HStack>
          </Dialog.Header>
          
          <Dialog.Body>
            <VStack gap={6} align="stretch">
              {!topicSelected ? (
                // お題未選択時: カテゴリ選択
                <VStack align="stretch" gap={3}>
                  <Text fontWeight="bold" fontSize="md">
                    📝 お題カテゴリを選択
                  </Text>
                  <HStack gap={2}>
                    {topicTypeLabels.map((cat) => (
                      <AppButton
                        key={cat}
                        onClick={() => handleCategorySelect(cat)}
                        colorPalette="brand"
                        flex="1"
                      >
                        {cat}
                      </AppButton>
                    ))}
                  </HStack>
                </VStack>
              ) : (
                // お題選択済み: 詳細操作
                <VStack align="stretch" gap={4}>
                  <VStack align="stretch" gap={2}>
                    <Text fontWeight="bold" fontSize="md">
                      🎲 お題の調整
                    </Text>
                    <HStack gap={2}>
                      <AppButton
                        onClick={handleShuffle}
                        variant="outline"
                        flex="1"
                      >
                        シャッフル
                      </AppButton>
                      <AppButton
                        onClick={handleReselect}
                        variant="ghost"
                        flex="1"
                      >
                        お題を選び直す
                      </AppButton>
                    </HStack>
                  </VStack>

                  <VStack align="stretch" gap={2}>
                    <Text fontWeight="bold" fontSize="md">
                      🎯 ゲーム開始
                    </Text>
                    <AppButton
                      onClick={handleDealNumbers}
                      colorPalette="orange"
                      disabled={tooFewPlayers}
                      title={tooFewPlayers ? `プレイヤーは${MIN_PLAYERS_FOR_DEAL}人以上必要です` : undefined}
                    >
                      数字配布
                    </AppButton>
                  </VStack>
                </VStack>
              )}

              <Box
                bg="yellow.50"
                p={3}
                borderRadius="md"
                border="1px solid"
                borderColor="yellow.200"
              >
                <Text fontSize="sm" color="yellow.800">
                  💡 <strong>ヒント:</strong> 通常は「ワンクリック開始」がおすすめです。
                  こちらの詳細設定は、お題を細かく調整したい場合にお使いください。
                </Text>
              </Box>
            </VStack>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

export default AdvancedHostPanel;