"use client";
import { submitSortedOrder } from "@/lib/game/room";
import { topicControls } from "@/lib/game/topicControls";
import { notify } from "@/components/ui/notify";
import { topicTypeLabels } from "@/lib/topics";
import { buildHostActionModel, HostIntent } from "@/lib/host/hostActionsModel";
import type { RoomDoc, PlayerDoc } from "@/lib/types";

export type HostAction = {
  key: string;
  label: string;
  onClick: () => Promise<void> | void;
  disabled?: boolean;
  title?: string;
  palette?: "brand" | "orange" | "gray" | "teal";
  variant?: "solid" | "outline" | "ghost" | "subtle" | "soft" | "link";
};

export function useHostActions({
  room,
  players,
  roomId,
  hostPrimaryAction,
  onlineCount,
}: {
  room: RoomDoc & { id?: string };
  players: (PlayerDoc & { id: string })[];
  roomId: string;
  hostPrimaryAction?: { label: string; onClick: () => void | Promise<void>; disabled?: boolean; title?: string } | null;
  onlineCount?: number;
}): HostAction[] {
  // build intents purely
  const intents = buildHostActionModel(
    room,
    players,
    typeof onlineCount === "number" ? onlineCount : undefined,
    topicTypeLabels,
    hostPrimaryAction ? { label: hostPrimaryAction.label } : null
  );

  // bind onClick at UI layer
  const actions: HostAction[] = intents.map((i: HostIntent): HostAction => {
    const uniqueKey = i.key + (i?.payload?.category ? `-${i.payload.category}` : "");
    const base = {
      key: uniqueKey,
      label: i.label,
      disabled: i.disabled,
      title: i.reason,
      palette: i.palette,
      variant: i.variant,
    } as Omit<HostAction, "onClick">;

    switch (i.key) {
      case "primary":
        return {
          ...base,
          disabled: hostPrimaryAction?.disabled,
          title: hostPrimaryAction?.title,
          onClick: hostPrimaryAction?.onClick || (() => {}),
        } as HostAction;
      case "pickTopic":
        return {
          ...base,
          onClick: async () => {
            await topicControls.selectCategory(roomId, i?.payload?.category as any);
          },
        } as HostAction;
      case "shuffle":
        return {
          ...base,
          onClick: async () => {
            await topicControls.shuffleTopic(roomId, ((room as any)?.topicBox as string) || null);
          },
        } as HostAction;
      case "deal":
        return {
          ...base,
          onClick: async () => {
            if (!((room as any)?.topic)) {
              notify({ title: "先にお題を設定", type: "warning" });
              return;
            }
            await topicControls.dealNumbers(roomId);
            notify({ title: "数字を配布しました", type: "success" });
          },
        } as HostAction;
      case "reselect":
        return {
          ...base,
          onClick: async () => {
            await topicControls.resetTopic(roomId);
          },
        } as HostAction;
      case "evaluate":
        return {
          ...base,
          onClick: async () => {
            const proposal: string[] = ((room as any)?.order?.proposal || []) as string[];
            const assigned = players.filter((p) => typeof (p as any)?.number === "number").length;
            if (proposal.length === 0) {
              notify({ title: "まだカードが場にありません", type: "info" });
              return;
            }
            if (proposal.length !== assigned) {
              notify({ title: "まだ全員のカードが場に出ていません", type: "warning" });
              return;
            }
            await submitSortedOrder(roomId, proposal);
            notify({ title: "一括判定を実行", type: "success" });
          },
        } as HostAction;
      default:
        return { ...base, onClick: () => {} } as HostAction;
    }
  });

  return actions;
}
