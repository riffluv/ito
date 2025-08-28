"use client";
import { useHostActions } from "@/components/hooks/useHostActions";
import { AdvancedHostPanel } from "@/components/ui/AdvancedHostPanel";
import { AppButton } from "@/components/ui/AppButton";
import { QuickTopicChange } from "@/components/ui/QuickTopicChange";
import { QuickNumberRedeal } from "@/components/ui/QuickNumberRedeal";
import Tooltip from "@/components/ui/Tooltip";
import { notify } from "@/components/ui/notify";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { Box, Dialog, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";

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

function HostControlDock({
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
  const pickingCategory = status === "clue" && !(room as any)?.topic;

  // 並び順: waiting => [開始, 詳細] / clue(sort-submit) => [詳細, evaluate] / その他 => 取得順
  const quick = actions.find((a) => a.key.startsWith("quickStart"));
  const evaluate = actions.find((a) => a.key.startsWith("evaluate"));
  const advanced = actions.find((a) => a.key.includes("advancedMode"));
  const baseOthers = actions.filter(
    (a) => a !== quick && a !== evaluate && a !== advanced
  );
  const ordered = useMemo(() => {
    if (isWaiting) {
      return [quick, advanced, ...baseOthers].filter(Boolean) as typeof actions;
    }
    const resolveMode = (room as any)?.options?.resolveMode;
    if (status === "clue" && resolveMode === "sort-submit") {
      return [advanced, ...baseOthers, evaluate].filter(
        Boolean
      ) as typeof actions;
    }
    return actions;
    // actions 配列内の disabled 変化も拾うため actions を直接依存に含める
  }, [isWaiting, status, (room as any)?.options?.resolveMode, actions]);

  // Show direct action buttons in waiting and clue phases
  const showQuickActions = isWaiting || status === "clue";

  return (
    <>
      <Box display="flex" gap={2} flexWrap="wrap" justifyContent="flex-end" alignItems="center">
        {/* Quick Action Buttons - Primary UX */}
        {showQuickActions && (
          <>
            <QuickTopicChange 
              roomId={roomId}
              room={room}
              size="sm"
            />
            <QuickNumberRedeal 
              roomId={roomId}
              room={room}
              players={players}
              onlineCount={onlineCount}
              size="sm"
            />
          </>
        )}
        
        {/* Traditional Host Actions */}
        {ordered.map((a) => {
          const isAdvanced = a.key.includes("advancedMode");
          // Skip quickStart in clue phase since we have dedicated buttons
          if (status === "clue" && a.key.startsWith("quickStart")) return null;
          
          const tooltip = a.title || (a.disabled ? "利用できません" : "");
          return (
            <Tooltip key={a.key} content={tooltip} disabled={!tooltip}>
              <AppButton
                aria-disabled={a.disabled ? true : undefined}
                aria-label={a.label}
                onClick={isAdvanced ? () => setAdvancedOpen(true) : a.onClick}
                disabled={a.disabled}
                colorPalette={a.palette as any}
                variant={a.variant as any}
                size="sm"
              >
                {a.label}
              </AppButton>
            </Tooltip>
          );
        }).filter(Boolean)}

        {!pickingCategory && !isWaiting && (
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

      <AdvancedHostPanel
        isOpen={advancedOpen}
        onClose={() => setAdvancedOpen(false)}
        roomId={roomId}
        room={room}
        players={players}
        onlineCount={onlineCount}
      />

      <Dialog.Root
        open={confirmOpen}
        onOpenChange={(d) => setConfirmOpen(d.open)}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
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
                    notify({ title: "リセットしました", type: "success" });
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

export default HostControlDock;
