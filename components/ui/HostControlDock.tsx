"use client";
import { AppButton } from "@/components/ui/AppButton";
import Tooltip from "@/components/ui/Tooltip";
import { notify } from "@/components/ui/notify";
import { submitSortedOrder } from "@/lib/game/room";
import { topicControls, topicTypeLabels } from "@/lib/game/topicControls";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import {
  Box,
  Flex,
  HStack,
  Menu,
  Popover,
  Text,
  Dialog,
} from "@chakra-ui/react";
import { FiChevronDown, FiHash, FiRefreshCw, FiShuffle, FiMoreVertical } from "react-icons/fi";
import { useMemo, useState } from "react";

export type HostControlDockProps = {
  roomId: string;
  room: RoomDoc & { id?: string };
  players: (PlayerDoc & { id: string })[];
  onlineCount?: number;
  hostPrimaryAction: {
    label: string;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
    title?: string;
  } | null;
  onReset: () => void | Promise<void>;
};

export function HostControlDock({
  roomId,
  room,
  players,
  onlineCount = 0,
  hostPrimaryAction,
  onReset,
}: HostControlDockProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const canStart = room?.status === "waiting";
  const canAgain = room?.status === "finished";
  const canDeal = !!room?.topic && room?.status === "clue";
  const canEval = room?.options?.resolveMode === "sort-submit" && room?.status === "clue";

  const assignedCount = useMemo(
    () => players.filter((p) => typeof (p as any)?.number === "number").length,
    [players.map((p) => `${p.id}:${(p as any)?.number ?? "_"}`).join("|")]
  );

  const doDeal = async () => {
    try {
      await topicControls.dealNumbers(roomId);
    } catch (err: any) {
      notify({ title: "数字配布に失敗", description: err?.message, type: "error" });
    }
  };

  const doEvaluate = async () => {
    const proposal: string[] = ((room as any)?.order?.proposal || []) as string[];
    if (proposal.length === 0) {
      notify({ title: "まだカードが場にありません", type: "info" });
      return;
    }
    if (assignedCount !== proposal.length) {
      notify({ title: "まだ全員のカードが場に出ていません", type: "warning" });
      return;
    }
    try {
      await submitSortedOrder(roomId, proposal);
      notify({ title: "一括判定を実行", type: "success" });
    } catch (err: any) {
      notify({ title: "一括判定失敗", description: err?.message, type: "error" });
    }
  };

  return (
    <Flex direction="column" gap={2} align="flex-end" w={{ base: "100%", xl: "auto" }}>
      {/* 上段: クイックバー（主要操作） */}
      <HStack gap={2} wrap="wrap" justify="flex-end" w="100%">
        {hostPrimaryAction && (canStart || canAgain) && (
          <AppButton
            colorPalette="orange"
            onClick={hostPrimaryAction.onClick}
            disabled={hostPrimaryAction.disabled}
            title={hostPrimaryAction.title}
          >
            {hostPrimaryAction.label}
            {typeof onlineCount === "number" && onlineCount > 0 && (
              <Box as="span" ml={2} opacity={0.8} fontWeight={600}>
                ({onlineCount})
              </Box>
            )}
          </AppButton>
        )}

        <Tooltip content={canDeal ? "オンライン参加者に数字を配布" : "先にお題を設定"} disabled={canDeal}>
          <AppButton variant="outline" onClick={doDeal} disabled={!canDeal}>
            <FiHash />
            <Box as="span" ml={1}>
              数字配布
            </Box>
          </AppButton>
        </Tooltip>

        {canEval && (
          <AppButton colorPalette="teal" onClick={doEvaluate}>
            🎯 せーので判定
          </AppButton>
        )}

        {/* 二次操作: メニューに格納 */}
        <Menu.Root positioning={{ gutter: 8 }}>
          <Menu.Trigger>
            <AppButton variant="ghost" aria-label="その他">
              <FiMoreVertical />
            </AppButton>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item
                value="reset"
                onClick={() => setConfirmOpen(true)}
                alignItems="center"
                cursor="pointer"
              >
                <FiRefreshCw style={{ marginRight: 8 }} /> リセット
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      </HStack>

      {/* 下段: お題管理をポップオーバー化して省スペース化 */}
      <Popover.Root positioning={{ gutter: 8 }}>
        <Popover.Trigger>
          <AppButton variant="outline">
            お題 <FiChevronDown style={{ marginLeft: 6 }} />
          </AppButton>
        </Popover.Trigger>
        <Popover.Positioner>
          <Popover.Content w={{ base: "92vw", md: "560px" }}>
            <Popover.Body>
              <Text fontSize="xs" color="fgMuted" mb={2}>
                カテゴリ選択
              </Text>
              <Flex wrap="wrap" gap={2}>
                {topicTypeLabels.map((label) => (
                  <AppButton
                    key={label}
                    size="xs"
                    variant={(room as any)?.topicBox === label ? "solid" : "outline"}
                    onClick={() => topicControls.selectCategory(roomId, label as any)}
                  >
                    {label.replace("版", "")}
                  </AppButton>
                ))}
              </Flex>

              <HStack mt={3}>
                <AppButton
                  size="sm"
                  variant="outline"
                  onClick={() => topicControls.shuffleTopic(roomId, (room as any).topicBox)}
                  disabled={!room?.topic}
                >
                  <FiShuffle />
                  <Box as="span" ml={1}>
                    シャッフル
                  </Box>
                </AppButton>
              </HStack>

              <Box mt={2}>
                <Text fontSize="xs" color="fgMuted">
                  現在: {(room as any)?.topic || "未選択"}
                </Text>
              </Box>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Popover.Root>

      {/* リセット確認ダイアログ */}
      <Dialog.Root open={confirmOpen} onOpenChange={(d) => setConfirmOpen(d.open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>ルームをリセット</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text>現在の進行と結果が破棄されます。よろしいですか？</Text>
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
                    notify({ title: "リセットしました", type: "success" });
                  } catch (e: any) {
                    notify({ title: "リセットに失敗", description: e?.message, type: "error" });
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
    </Flex>
  );
}

export default HostControlDock;

