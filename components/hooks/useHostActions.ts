"use client";
import { notify } from "@/components/ui/notify";
import {
  startGame as startGameAction,
  submitSortedOrder,
} from "@/lib/game/room";
import { topicControls } from "@/lib/game/topicControls";
import { buildHostActionModel, HostIntent } from "@/lib/host/hostActionsModel";
import { topicTypeLabels } from "@/lib/topics";
import type { PlayerDoc, RoomDoc } from "@/lib/types";

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
  hostPrimaryAction?: {
    label: string;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
    title?: string;
  } | null;
  onlineCount?: number;
}): HostAction[] {
  const intents = buildHostActionModel(
    room,
    players,
    typeof onlineCount === "number" ? onlineCount : undefined,
    topicTypeLabels,
    hostPrimaryAction ? { label: hostPrimaryAction.label } : null
  );

  const actions: HostAction[] = intents.map((i: HostIntent): HostAction => {
    const uniqueKey =
      i.key + (i?.payload?.category ? `-${i.payload.category}` : "");
    const make = (onClick: () => Promise<void> | void): HostAction => ({
      key: uniqueKey,
      label: i.label,
      disabled: i.disabled,
      title: i.reason,
      palette: i.palette,
      variant: i.variant,
      onClick,
    });

    if (i.key === "primary") {
      return make(hostPrimaryAction?.onClick || (() => {}));
    }
    if (i.key === "evaluate") {
      return make(async () => {
        const proposal: string[] = ((room as any)?.order?.proposal ||
          []) as string[];
        const orderList: string[] = ((room as any)?.order?.list ||
          []) as string[];
        const activeCount =
          typeof onlineCount === "number" ? onlineCount : players.length;
        const placedCount =
          proposal.length > 0 ? proposal.length : orderList.length;
        if (placedCount < 2 || placedCount !== activeCount) {
          notify({
            title: "まだ全員分が揃っていません",
            description: `提出: ${placedCount}/${activeCount}`,
            type: "warning",
          });
          return;
        }
        const finalOrder = proposal.length > 0 ? proposal : orderList;
        await submitSortedOrder(roomId, finalOrder);
        notify({ title: "並びを確定", type: "success" });
      });
    }
    if (i.key === "quickStart") {
      return make(async () => {
        try {
          // 最新 props に基づく人数再検証（稀な遅延差分対策）
          const activeCount =
            typeof onlineCount === "number" ? onlineCount : players.length;
          if (activeCount < 2) {
            notify({ title: "プレイヤーは2人以上必要です", type: "info" });
            return;
          }
          const defaultType =
            (room as any)?.options?.defaultTopicType || "通常版";
          // 手順を明確化: status 遷移 -> topic -> deal
          if ((room as any)?.status === "waiting") {
            await startGameAction(roomId); // sets status: clue
          }
          await topicControls.selectCategory(roomId, defaultType as any);
          await topicControls.dealNumbers(roomId);
          notify({ title: "🚀 クイック開始しました", type: "success" });
        } catch (error: any) {
          notify({
            title: "クイック開始に失敗",
            description: error?.message,
            type: "error",
          });
        }
      });
    }
    if (i.key === "advancedMode") {
      return make(() => {});
    }
    // それ以外(旧pickTopic等) は no-op
    return make(() => {});
  });

  return actions;
}
