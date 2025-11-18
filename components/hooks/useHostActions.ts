"use client";
import { notify, muteNotifications } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { buildHostActionModel, HostIntent } from "@/lib/host/hostActionsModel";
import { topicTypeLabels } from "@/lib/topics";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { handleGameError } from "@/lib/utils/errorHandling";
import { useCallback, useMemo, useState } from "react";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  createHostActionsController,
  type HostActionsController,
} from "@/lib/host/HostActionsController";

const normalizeProposalIds = (source: unknown): string[] =>
  Array.isArray(source)
    ? source.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      )
    : [];

const normalizeOrderList = (source: unknown): string[] =>
  Array.isArray(source)
    ? source.filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0
      )
    : [];

export type HostAction = {
  key: string;
  label: string;
  onClick: () => Promise<void> | void;
  disabled?: boolean;
  title?: string;
  palette?: "brand" | "orange" | "gray" | "teal";
  variant?: "solid" | "outline" | "ghost" | "subtle" | "soft" | "link";
  busy?: boolean;
};

type AutoStartControl = {
  locked: boolean;
  begin: (
    duration?: number,
    options?: { broadcast?: boolean; delayMs?: number }
  ) => void;
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
  const [evaluatePending, setEvaluatePending] = useState(false);
  const hostActions = useMemo<HostActionsController>(
    () => createHostActionsController(),
    []
  );
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
    if (evaluatePending) return;
    setEvaluatePending(true);
    const proposal = normalizeProposalIds(room.order?.proposal);
    const orderList = normalizeOrderList(room.order?.list);
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
    try {
      traceAction("ui.order.evaluate", {
        roomId,
        count: finalOrder.length,
      });
      await hostActions.evaluateSortedOrder({ roomId, list: finalOrder });
      notify({
        id: toastIds.genericInfo(roomId, "evaluate-success"),
        title: "並びを確定",
        type: "success",
        duration: 1800,
      });
    } catch (error) {
      traceError("ui.order.evaluate", error, {
        roomId,
        count: finalOrder.length,
      });
      handleGameError(error, "並び確定");
    } finally {
      setEvaluatePending(false);
    }
  }, [
    evaluatePending,
    room.order?.proposal,
    room.order?.list,
    onlineCount,
    players.length,
    roomId,
    hostActions,
  ]);

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
      traceAction("ui.host.quickStart", {
        roomId,
        activeCount: String(activeCount),
        defaultType,
      });
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
      const result = await hostActions.quickStartWithTopic({
        roomId,
        roomStatus: room.status,
        defaultTopicType: defaultType,
        currentTopic:
          typeof room.topic === "string" ? (room.topic as string) : null,
        presenceInfo: {
          presenceReady: true,
          playerCount: activeCount,
        },
      });

      if (!result.ok) {
        if (result.reason === "needs-custom-topic") {
          notify({
            id: toastIds.genericInfo(roomId, "custom-topic-missing"),
            title: "カスタムお題が未入力です",
            description: "お題を入力してから開始してください",
            type: "warning",
            duration: 2200,
          });
        } else if (result.reason === "host-mismatch") {
          notify({
            id: toastIds.genericInfo(roomId, "host-mismatch"),
            title: "ホスト権限を確認しています",
            description: "権限が確定するまで数秒お待ちください",
            type: "warning",
            duration: 2200,
          });
        }
      }
    } catch (error) {
      traceError("ui.host.quickStart", error, { roomId });
      autoStartControl?.clear?.();
      handleGameError(error, "クイック開始");
    }
  }, [
    autoStartControl,
    onlineCount,
    players.length,
    room.options?.defaultTopicType,
    room.status,
    room.topic,
    roomId,
    hostActions,
  ]);

  // resetアクションのハンドラーを個別にメモ化
  const handleReset = useCallback(async () => {
    try {
      traceAction("ui.room.reset", { roomId });
      const playerIds = players.map((p) => p.id).filter(Boolean);
      await hostActions.resetRoomToWaitingWithPrune({
        roomId,
        roundIds: playerIds,
        onlineUids: playerIds,
        includeOnline: true,
        recallSpectators: true,
      });
      notify({
        id: toastIds.gameReset(roomId),
        title: "ゲームをリセットしました",
        type: "success",
        duration: 2000,
      });
    } catch (error) {
      traceError("ui.room.reset", error, { roomId });
      handleGameError(error, "ゲームリセット");
    }
  }, [roomId, players, hostActions]);

  // actionsをメモ化してパフォーマンスを向上
  const actions: HostAction[] = useMemo(() => intents.map((i: HostIntent): HostAction => {
    const uniqueKey =
      i.key + (i?.payload?.category ? `-${i.payload.category}` : "");
    const make = (
      onClick: () => Promise<void> | void,
      overrides?: Partial<HostAction>
    ): HostAction => ({
      key: uniqueKey,
      label: i.label,
      disabled: overrides?.disabled ?? i.disabled,
      title: i.reason,
      palette: i.palette,
      variant: i.variant,
      onClick,
      busy: overrides?.busy,
    });

    if (i.key === "primary") {
      return make(hostPrimaryAction?.onClick || (() => {}));
    }
    if (i.key === "evaluate") {
      return make(handleEvaluate, {
        disabled: i.disabled || evaluatePending,
        busy: evaluatePending,
      });
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
  }), [intents, hostPrimaryAction, handleEvaluate, handleQuickStart, handleReset, evaluatePending, autoStartControl?.locked]);

  return actions;
}
