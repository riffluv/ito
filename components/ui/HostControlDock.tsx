"use client";
import { AppButton } from "@/components/ui/AppButton";
import Tooltip from "@/components/ui/Tooltip";
import { notify } from "@/components/ui/notify";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { Box, Flex, HStack, Text, Dialog } from "@chakra-ui/react";
import { FiRefreshCw } from "react-icons/fi";
import { useMemo, useState } from "react";
import { useHostActions } from "@/components/hooks/useHostActions";

import { AdvancedHostPanel } from "@/components/ui/AdvancedHostPanel";
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // 動的ホストアクション（UI層は並べるだけ）
  const actions = useHostActions({ room, players, roomId, hostPrimaryAction, onlineCount });
  const pickingCategory = (room as any)?.status === "clue" && !(room as any)?.topic;

  return (
    <>
      {/* Host Control Actions - Professional Style */}
      <Box display="flex" gap={3} flexWrap="wrap" justifyContent="flex-end">
        {actions.map((a) => (
          <Tooltip key={a.key} content={a.title || ""} disabled={!a.title}>
            <AppButton
              onClick={a.key === "advancedMode" ? () => setAdvancedOpen(true) : a.onClick}
              disabled={a.disabled}
              colorPalette={a.palette as any}
              variant={a.variant as any}
              size="sm"
            >
              {a.label}
            </AppButton>
          </Tooltip>
        ))}
        
        {!pickingCategory && (
          <AppButton 
            variant="ghost" 
            size="sm" 
            onClick={() => setConfirmOpen(true)} 
            title="最初からやり直す"
          >
            <FiRefreshCw style={{ marginRight: 6 }} /> リセット
          </AppButton>
        )}
      </Box>

      {/* Advanced Host Panel */}
      <AdvancedHostPanel
        isOpen={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        roomId={roomId}
        room={room}
        players={players}
        onlineCount={onlineCount}
      />

      {/* Reset Confirmation Dialog */}
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
    </>
  );
}

export default HostControlDock;