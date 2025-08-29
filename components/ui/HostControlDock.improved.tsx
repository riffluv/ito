"use client";
import { useHostActions } from "@/components/hooks/useHostActions";
import { AdvancedHostPanel } from "@/components/ui/AdvancedHostPanel";
import { AppButton } from "@/components/ui/AppButton";
import { NumberDealButton } from "@/components/ui/NumberDealButton";
import { TopicShuffleButton } from "@/components/ui/TopicShuffleButton";
import Tooltip from "@/components/ui/Tooltip";
import { notify } from "@/components/ui/notify";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import {
  Badge,
  Card,
  Dialog,
  Flex,
  HStack,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMemo, useState } from "react";
import {
  FiCheck,
  FiPlay,
  FiRefreshCw,
  FiSettings,
  FiUsers,
} from "react-icons/fi";

export interface HostControlDockProps {
  room: RoomDoc & { id?: string };
  roomId: string;
  players: (PlayerDoc & { id: string })[];
  onlineCount?: number;
  hostPrimaryAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
    title?: string;
  } | null;
  onReset: () => Promise<void>;
}

function HostControlDockImproved({
  room,
  roomId,
  players,
  onlineCount,
  hostPrimaryAction,
  onReset,
}: HostControlDockProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const actions = useHostActions({
    room,
    players,
    roomId,
    hostPrimaryAction,
    onlineCount,
  });

  const status = (room as any)?.status as string | undefined;
  const isWaiting = status === "waiting";
  const isClue = status === "clue";
  const pickingCategory = isClue && !(room as any)?.topic;
  const activeCount =
    typeof onlineCount === "number" ? onlineCount : players.length;
  const resolveMode = (room as any)?.options?.resolveMode;

  // アクションの分類
  const primaryAction = actions.find(
    (a) => a.key.startsWith("quickStart") || a.key.startsWith("primary")
  );
  const evaluateAction = actions.find((a) => a.key.startsWith("evaluate"));
  const advancedAction = actions.find((a) => a.key.includes("advancedMode"));

  // ゲーム状態の表示情報
  const gameState = useMemo(() => {
    if (isWaiting) {
      return {
        phase: "待機中",
        description: "ゲームを開始しましょう",
        color: "gray" as const,
      };
    }
    if (pickingCategory) {
      return {
        phase: "設定中",
        description: "お題を選択してください",
        color: "orange" as const,
      };
    }
    if (isClue) {
      return {
        phase: "プレイ中",
        description: "プレイヤーの操作を待っています",
        color: "green" as const,
      };
    }
    return {
      phase: "準備完了",
      description: "ゲームの準備ができました",
      color: "blue" as const,
    };
  }, [isWaiting, isClue, pickingCategory]);

  return (
    <>
      {/* PCフッター統合版: 横並びのシンプルレイアウト */}
      <Flex 
        align="center" 
        gap={4} 
        bg="gray.50" 
        border="1px solid" 
        borderColor="gray.200"
        borderRadius="lg" 
        px={4} 
        py={3}
        minH="60px"
      >
        {/* 左側: ゲーム状態表示 */}
        <HStack gap={3}>
          <Badge colorPalette={gameState.color} variant="solid" size="sm">
            {gameState.phase}
          </Badge>
          <HStack gap={1} color="gray.600">
            {/* user count removed per UX request */}
          </HStack>
        </HStack>

        {/* 中央: メインアクション */}
        <HStack gap={2} flex={1} justify="center">
          {/* クイック操作（待機・プレイ中） */}
          {(isWaiting || isClue) && (
            <>
              <TopicShuffleButton 
                roomId={roomId}
                room={room}
                size="sm"
              />
              <NumberDealButton 
                roomId={roomId}
                room={room}
                players={players}
                onlineCount={onlineCount}
                size="sm"
              />
            </>
          )}
          
          {/* メインアクション */}
          {primaryAction && (
            <Tooltip content={primaryAction.title || primaryAction.label}>
              <AppButton
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                colorPalette={primaryAction.palette as any}
                variant="solid"
                size="sm"
              >
                <Text>{primaryAction.label}</Text>
              </AppButton>
            </Tooltip>
          )}
          
          {/* 確定ボタン（sort-submit モード） */}
          {evaluateAction && (
            <Tooltip content={evaluateAction.title || evaluateAction.label}>
              <AppButton
                onClick={evaluateAction.onClick}
                disabled={evaluateAction.disabled}
                colorPalette={evaluateAction.palette as any}
                variant="solid"
                size="sm"
              >
                <HStack gap={1}>
                  <FiCheck size={14} />
                  <Text>{evaluateAction.label}</Text>
                </HStack>
              </AppButton>
            </Tooltip>
          )}
        </HStack>

        {/* 右側: リセット */}
        <HStack gap={2}>
          {/* リセットボタン（控えめに） */}
          {!pickingCategory && !isWaiting && (
            <Tooltip content="ゲームをリセット">
              <AppButton
                variant="ghost"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                colorPalette="gray"
              >
                <FiRefreshCw size={14} />
              </AppButton>
            </Tooltip>
          )}
        </HStack>
      </Flex>
        <Card.Header pb={2}>
          <Flex justify="space-between" align="center">
            <VStack gap={0} align="start">
              <HStack gap={2}>
                <Badge colorPalette={gameState.color} variant="solid" size="sm">
                  {gameState.phase}
                </Badge>
                <HStack gap={1} color="gray.600">
                  {/* user count removed per UX request */}
                </HStack>
              </HStack>
              <Text fontSize="xs" color="gray.500" mt={1}>
                {gameState.description}
              </Text>
            </VStack>

            {/* 詳細設定ボタン - 右上に配置 */}
            {advancedAction && (
              <Tooltip content="詳細設定を開く">
                <AppButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdvancedOpen(true)}
                  aria-label="詳細設定"
                  colorPalette="gray"
                >
                  <FiSettings />
                </AppButton>
              </Tooltip>
            )}
          </Flex>
        </Card.Header>

        <Card.Body pt={0}>
          <Stack gap={3}>
            {/* クイック操作エリア（待機・プレイ中） */}
            {(isWaiting || isClue) && (
              <VStack gap={2} align="stretch">
                <Text fontSize="sm" fontWeight="medium" color="gray.700">
                  クイック操作
                </Text>

                <HStack gap={2} justify="stretch">
                  <TopicShuffleButton roomId={roomId} room={room} size="sm" />
                  <NumberDealButton
                    roomId={roomId}
                    room={room}
                    players={players}
                    onlineCount={onlineCount}
                    size="sm"
                  />
                </HStack>
              </VStack>
            )}

            {/* メインアクションエリア */}
            {primaryAction && (
              <VStack gap={2} align="stretch">
                <Text fontSize="sm" fontWeight="medium" color="gray.700">
                  ゲーム操作
                </Text>

                <Tooltip content={primaryAction.title || primaryAction.label}>
                  <AppButton
                    onClick={primaryAction.onClick}
                    disabled={primaryAction.disabled}
                    colorPalette={primaryAction.palette as any}
                    variant={primaryAction.variant as any}
                    size="md"
                    width="full"
                    minH="48px" // モバイルタッチ領域
                  >
                    <Text>{primaryAction.label}</Text>
                  </AppButton>
                </Tooltip>
              </VStack>
            )}

            {/* 確定ボタン（sort-submit モード） */}
            {evaluateAction && (
              <VStack gap={2} align="stretch">
                <Text fontSize="sm" fontWeight="medium" color="gray.700">
                  結果確認
                </Text>

                <Tooltip content={evaluateAction.title || evaluateAction.label}>
                  <AppButton
                    onClick={evaluateAction.onClick}
                    disabled={evaluateAction.disabled}
                    colorPalette={evaluateAction.palette as any}
                    variant="solid"
                    size="md"
                    width="full"
                    minH="48px"
                  >
                    <HStack gap={2}>
                      <FiCheck size={16} />
                      <Text>{evaluateAction.label}</Text>
                    </HStack>
                  </AppButton>
                </Tooltip>

                {evaluateAction.disabled && evaluateAction.title && (
                  <Text fontSize="xs" color="orange.600" textAlign="center">
                    {evaluateAction.title}
                  </Text>
                )}
              </VStack>
            )}
          </Stack>
        </Card.Body>

        {/* リセットボタン（控えめに下部に配置） */}
        {!pickingCategory && !isWaiting && (
          <Card.Footer pt={0} borderTop="1px solid" borderColor="gray.100">
            <AppButton
              variant="ghost"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              colorPalette="gray"
              width="full"
            >
              <HStack gap={2}>
                <FiRefreshCw size={14} />
                <Text>リセット</Text>
              </HStack>
            </AppButton>
          </Card.Footer>
        )}
      </Card.Root>

      {/* 詳細設定パネル */}
      <AdvancedHostPanel
        isOpen={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        roomId={roomId}
        room={room}
        players={players}
        onlineCount={onlineCount}
      />

      {/* リセット確認ダイアログ */}
      <Dialog.Root
        open={confirmOpen}
        onOpenChange={(d) => setConfirmOpen(d.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="sm">
            <Dialog.Header>
              <Dialog.Title>部屋をリセット</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>現在の進行と並び順を消去します。よろしいですか？</Text>
            </Dialog.Body>
            <Dialog.Footer display="flex" gap={2} justifyContent="flex-end">
              <AppButton variant="ghost" onClick={() => setConfirmOpen(false)}>
                キャンセル
              </AppButton>
              <AppButton
                colorPalette="orange"
                onClick={async () => {
                  try {
                    await onReset();
                    notify({
                      title: "リセットしました",
                      type: "success",
                    });
                  } catch (e: any) {
                    notify({
                      title: "リセットに失敗",
                      description: e?.message,
                      type: "error",
                    });
                  } finally {
                    setConfirmOpen(false);
                  }
                }}
              >
                実行
              </AppButton>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
}

export default HostControlDockImproved;
