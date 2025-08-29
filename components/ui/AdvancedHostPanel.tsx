"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { topicControls } from "@/lib/game/topicControls";
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

  // デフォルトモードは "sequential" (通常モード)
  const currentMode = room.options?.resolveMode || "sequential";

  const handleCategorySelect = async (category: string) => {
    try {
      await topicControls.selectCategory(roomId, category as any);
      // 選択後もパネルを開いたままにして、シャッフルや数字配布を可能にする
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
      await topicControls.shuffleTopic(
        roomId,
        ((room as any)?.topicBox as string) || null
      );
    } catch (error: any) {
      notify({
        title: "シャッフルに失敗",
        description: error?.message,
        type: "error",
      });
    }
  };

  const handleModeChange = async (mode: "sequential" | "sort-submit") => {
    try {
      const { updateDoc, doc } = await import("firebase/firestore");
      const { db } = await import("@/lib/firebase/client");

      await updateDoc(doc(db!, "rooms", roomId), {
        "options.resolveMode": mode,
      });

      notify({
        title: `モードを${mode === "sequential" ? "通常モード" : "一括判定モード"}に変更しました`,
        type: "success",
      });
    } catch (error: any) {
      notify({
        title: "モード変更に失敗",
        description: error?.message,
        type: "error",
      });
    }
  };

  const handleResetRoom = async () => {
    try {
      await topicControls.resetTopic(roomId);
      notify({ title: "ルームをリセットしました", type: "success" });
    } catch (error: any) {
      notify({
        title: "ルームリセットに失敗",
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
              {/* 上級者向け設定のみ */}
              <VStack align="stretch" gap={4}>
                <VStack align="stretch" gap={2}>
                  <Text fontWeight="bold" fontSize="md">
                    🔧 ゲームモード設定
                  </Text>
                  <HStack gap={2}>
                    <AppButton
                      variant={
                        currentMode === "sequential" ? "solid" : "outline"
                      }
                      colorPalette="blue"
                      flex="1"
                      onClick={() => handleModeChange("sequential")}
                    >
                      通常モード
                    </AppButton>
                    <AppButton
                      variant={
                        currentMode === "sort-submit" ? "solid" : "outline"
                      }
                      colorPalette="blue"
                      flex="1"
                      onClick={() => handleModeChange("sort-submit")}
                    >
                      一括判定
                    </AppButton>
                  </HStack>
                  <Text fontSize="xs" color="gray.600">
                    通常: リアルタイム判定　｜　一括: 相談して並び替え後判定
                  </Text>
                </VStack>

                <VStack align="stretch" gap={2}>
                  <Text fontWeight="bold" fontSize="md">
                    🎮 ゲーム管理
                  </Text>
                  <HStack gap={2}>
                    <AppButton
                      onClick={handleResetRoom}
                      variant="ghost"
                      colorPalette="red"
                      flex="1"
                    >
                      ルームリセット
                    </AppButton>
                  </HStack>
                  <Text fontSize="xs" color="gray.600">
                    ゲームを待機状態に戻します。
                  </Text>
                </VStack>
              </VStack>

            </VStack>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

export default AdvancedHostPanel;
