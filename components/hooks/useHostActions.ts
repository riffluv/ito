"use client";
import { notify, muteNotifications } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { submitSortedOrder } from "@/lib/game/room";
import { topicControls } from "@/lib/game/topicControls";
import { buildHostActionModel, HostIntent } from "@/lib/host/hostActionsModel";
import { topicTypeLabels } from "@/lib/topics";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { handleGameError, withErrorHandling } from "@/lib/utils/errorHandling";
import { useCallback, useMemo } from "react";
import { executeQuickStart } from "@/lib/game/quickStart";

export type HostAction = {
  key: string;
  label: string;
  onClick: () => Promise<void> | void;
  disabled?: boolean;
  title?: string;
  palette?: "brand" | "orange" | "gray" | "teal";
  variant?: "solid" | "outline" | "ghost" | "subtle" | "soft" | "link";
};

type AutoStartControl = {
  locked: boolean;
  begin: (duration?: number, options?: { broadcast?: boolean }) => void;
  clear: () => void;
};

export function useHostActions({
  room,
  players,
  roomId,
  hostPrimaryAction,
  onlineCount,
  autoStartControl,
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
  autoStartControl?: AutoStartControl;
}): HostAction[] {
  // buildHostActionModelをメモ化して不必要な再計算を防ぐ
  const intents = useMemo(
    () => buildHostActionModel(
      room,
      players,
      typeof onlineCount === "number" ? onlineCount : undefined,
      topicTypeLabels,
      hostPrimaryAction ? { label: hostPrimaryAction.label } : null
    ),
    [room, players, onlineCount, hostPrimaryAction]
  );

  // evaluateアクションのハンドラーを個別にメモ化
  const handleEvaluate = useCallback(async () => {
    const proposal = room.order?.proposal ? [...room.order.proposal] : [];
    const orderList = room.order?.list ? [...room.order.list] : [];
    const activeCount =
      typeof onlineCount === "number" ? onlineCount : players.length;
    const placedCount =
      proposal.length > 0 ? proposal.length : orderList.length;
    if (placedCount < 2 || placedCount !== activeCount) {
      notify({
        id: toastIds.genericInfo(roomId, "evaluate-incomplete"),
        title: "まだ全員分が揃っていません",
        description: `提出: ${placedCount}/${activeCount}`,
        type: "warning",
        duration: 2200,
      });
      return;
    }
    const finalOrder = proposal.length > 0 ? proposal : orderList;
    await submitSortedOrder(roomId, finalOrder);
    notify({
      id: toastIds.genericInfo(roomId, "evaluate-success"),
      title: "並びを確定",
      type: "success",
      duration: 1800,
    });
  }, [room.order?.proposal, room.order?.list, onlineCount, players.length, roomId]);

  // quickStartアクションのハンドラーを個別にメモ化
  const handleQuickStart = useCallback(async () => {
    try {
      if (autoStartControl?.locked) {
        return;
      }
      const activeCount =
        typeof onlineCount === "number" ? onlineCount : players.length;
      if (activeCount < 2) {
        notify({
          id: toastIds.numberDealWarningPlayers(roomId),
          title: "プレイヤーは2人以上必要です",
          type: "warning",
          duration: 2200,
        });
        return;
      }
      const defaultType = room.options?.defaultTopicType || "通常版";
      autoStartControl?.begin?.(4500, { broadcast: true });
      muteNotifications(
        [
          toastIds.topicChangeSuccess(roomId),
          toastIds.topicShuffleSuccess(roomId),
          toastIds.numberDealSuccess(roomId),
          toastIds.gameReset(roomId),
        ],
        2800
      );
      await executeQuickStart(roomId, {
        roomStatus: room.status,
        defaultTopicType: defaultType,
      });
    } catch (error) {
      autoStartControl?.clear?.();
      handleGameError(error, "クイック開始");
    }
  }, [autoStartControl, onlineCount, players.length, room.options?.defaultTopicType, room.status, roomId]);

  // resetアクションのハンドラーを個別にメモ化
  const handleReset = useCallback(async () => {
    try {
      await topicControls.resetTopic(roomId);
      notify({
        id: toastIds.gameReset(roomId),
        title: "ゲームをリセットしました",
        type: "success",
        duration: 2000,
      });
    } catch (error) {
      handleGameError(error, "ゲームリセット");
    }
  }, [roomId]);

  // actionsをメモ化してパフォーマンスを向上
  const actions: HostAction[] = useMemo(() => intents.map((i: HostIntent): HostAction => {
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
      return make(handleEvaluate);
    }
    if (i.key === "quickStart") {
      const action = make(handleQuickStart);
      return {
        ...action,
        disabled: action.disabled || autoStartControl?.locked,
        title: autoStartControl?.locked ? "次のラウンドを準備中です" : action.title,
        label: autoStartControl?.locked ? "準備中..." : action.label,
      };
    }
    if (i.key === "advancedMode") {
      return make(() => {});
    }
    if (i.key === "reset") {
      return make(handleReset);
    }
    // それ以外(旧pickTopic等) は no-op
    return make(() => {});
  }), [intents, hostPrimaryAction, handleEvaluate, handleQuickStart, handleReset]);

  return actions;
}
