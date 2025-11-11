"use client";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { topicControls } from "@/lib/game/service";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { logError } from "@/lib/utils/log";
import { Dialog, HStack, Text, VStack } from "@chakra-ui/react";
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
  const totalPlayers = players.length;
  const topicSelected = typeof room.topic === "string" && room.topic.trim().length > 0;
  const tooFewPlayers = onlineCount < MIN_PLAYERS_FOR_DEAL;

  // デフォルトモードは "sort-submit" (一括判定モード)
  const currentMode = room.options?.resolveMode ?? "sort-submit";

  // ゲーム開始後はresolveMode変更を無効化
  const canChangeMode = room.status === "waiting";

  const handleResetRoom = async () => {
    try {
      await topicControls.resetTopic(roomId);
      notify({
        id: toastIds.gameReset(roomId),
        title: "ルームをリセットしました",
        type: "success",
        duration: 2000,
      });
    } catch (error: unknown) {
      logError("advanced-host-panel", "reset-topic", error);
      const description =
        error instanceof Error
          ? error.message
          : error && typeof error === "object" && "message" in error
            ? String((error as { message?: unknown }).message ?? "")
            : undefined;
      notify({
        id: toastIds.topicError(roomId),
        title: "ルームリセットに失敗",
        description: description || undefined,
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
                  <VStack align="stretch" gap={1}>
                    <Text fontSize="sm" fontWeight="bold">
                      現在のお題
                    </Text>
                    <Text fontSize="sm" color={topicSelected ? "gray.800" : "orange.600"}>
                      {topicSelected ? room.topic : "お題が未設定です"}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      カテゴリ: {room.topicBox ?? "未選択"}
                    </Text>
                  </VStack>
                  <VStack align="stretch" gap={0}>
                    <Text fontSize="sm" fontWeight="bold">
                      プレイヤー状況
                    </Text>
                    <Text fontSize="sm" color={tooFewPlayers ? "orange.600" : "gray.800"}>
                      オンライン {onlineCount} / {MIN_PLAYERS_FOR_DEAL} 人以上推奨
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      合計登録: {totalPlayers}人
                    </Text>
                  </VStack>
                  <VStack align="stretch" gap={0}>
                    <Text fontSize="sm" fontWeight="bold">
                      判定モード
                    </Text>
                    <Text fontSize="sm">
                      {currentMode === "sort-submit" ? "一括判定モード" : currentMode}
                    </Text>
                    <Text fontSize="xs" color="gray.600">
                      {canChangeMode
                        ? "ゲーム開始前のみモード変更が可能です"
                        : "進行中はモードを変更できません"}
                    </Text>
                  </VStack>
                  <Text fontWeight="bold" fontSize="md">
                    🎮 ゲーム管理
                  </Text>
                  <HStack gap={2}>
                    <AppButton
                      onClick={handleResetRoom}
                      variant="ghost"
                      colorPalette="danger"
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
