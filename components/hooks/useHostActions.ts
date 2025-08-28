"use client";
import { submitSortedOrder, startGame as startGameAction } from "@/lib/game/room";
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
  const intents = buildHostActionModel(
    room,
    players,
    typeof onlineCount === "number" ? onlineCount : undefined,
    topicTypeLabels,
    hostPrimaryAction ? { label: hostPrimaryAction.label } : null
  );

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

    // デバッグ: evaluateアクションの状態を確認
    if (i.key === "evaluate") {
      console.log("🎯 useHostActions evaluate:", {
        intentDisabled: i.disabled,
        baseDisabled: base.disabled,
        reason: i.reason
      });
    }

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
              notify({ title: "カテゴリを選択してください", type: "warning" });
              return;
            }
            await topicControls.dealNumbers(roomId);
            notify({ title: "番号を配布しました", type: "success" });
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
        const evaluateAction = {
          ...base,
          onClick: async () => {
            const proposal: string[] = ((room as any)?.order?.proposal || []) as string[];
            const assigned = players.filter((p) => typeof (p as any)?.number === "number").length;
            console.log("🚀 evaluate onClick:", { proposal, assigned });
            if (proposal.length === 0) {
              notify({ title: "カード案がまだありません", type: "info" });
              return;
            }
            if (proposal.length !== assigned) {
              notify({ title: "全員分のカードが揃っていません", type: "warning" });
              return;
            }
            await submitSortedOrder(roomId, proposal);
            notify({ title: "並びを確定", type: "success" });
          },
        } as HostAction;
        
        console.log("🎯 Final evaluate action:", {
          disabled: evaluateAction.disabled,
          title: evaluateAction.title
        });
        
        return evaluateAction;
      case "quickStart":
        return {
          ...base,
          onClick: async () => {
            try {
              const defaultType = (room as any)?.options?.defaultTopicType || "通常版";
              if ((room as any)?.status === "waiting") {
                await startGameAction(roomId);
              }
              await topicControls.selectCategory(roomId, defaultType as any);
              await topicControls.dealNumbers(roomId);
              notify({ title: "🚀 クイック開始しました", type: "success" });
            } catch (error: any) {
              notify({ title: "クイック開始に失敗", description: error?.message, type: "error" });
            }
          },
        } as HostAction;
      case "advancedMode":
        return { ...base, onClick: () => {} } as HostAction;
      default:
        return { ...base, onClick: () => {} } as HostAction;
    }
  });

  return actions;
}
