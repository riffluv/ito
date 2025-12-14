"use client";
import { notify, muteNotifications } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { buildHostActionModel, HostIntent } from "@/lib/host/hostActionsModel";
import { topicTypeLabels } from "@/lib/topics";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { handleGameError } from "@/lib/utils/errorHandling";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const roundPreparingWatchdogRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return () => {};
    }
    const isPreparing = Boolean(room.ui?.roundPreparing);
    const clearTimer = () => {
      if (roundPreparingWatchdogRef.current !== null) {
        window.clearTimeout(roundPreparingWatchdogRef.current);
        roundPreparingWatchdogRef.current = null;
      }
    };

    if (isPreparing) {
      if (roundPreparingWatchdogRef.current === null) {
        const localStatus = room.status ?? null;
        roundPreparingWatchdogRef.current = window.setTimeout(() => {
          roundPreparingWatchdogRef.current = null;
          void (async () => {
            if (!db) return;
            try {
              const ref = doc(db, "rooms", roomId);
              const snap = await getDocFromServer(ref).catch(() => getDoc(ref));
              const data = snap.data() as { status?: unknown; ui?: { roundPreparing?: unknown } } | undefined;
              const serverStatus =
                typeof data?.status === "string" ? data.status : null;
              const serverPreparing = Boolean(data?.ui?.roundPreparing);
              traceAction("ui.host.roundPreparing.stuck", {
                roomId,
                localStatus,
                serverStatus,
                serverPreparing,
              });
              if (serverStatus === "clue" && localStatus !== "clue") {
                try {
                  window.dispatchEvent(
                    new CustomEvent("ito:room-force-refresh", {
                      detail: {
                        roomId,
                        reason: "roundPreparing.watchdog",
                      },
                    })
                  );
                } catch {}
              }
              notify({
                id: toastIds.genericInfo(roomId, "roundpreparing-stuck"),
                title: "状態を再同期しています",
                description:
                  "ラウンド準備が完了しないようなので最新の状態を取得します。改善しない場合は再読み込みしてください。",
                type: "warning",
                duration: 4200,
              });
            } catch (error) {
              traceError("ui.host.roundPreparing.watchdog", error, { roomId });
            }
          })();
        }, 7000);
      }
    } else {
      clearTimer();
    }

    return clearTimer;
  }, [room.ui?.roundPreparing, room.status, roomId]);
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
      const activeCountRaw =
        typeof onlineCount === "number" ? onlineCount : players.length;
      // 初回同期で0〜1人になることがあるので、1人でも進める。警告だけ出す。
      const activeCount = Math.max(1, activeCountRaw);
      if (activeCountRaw < 2) {
        notify({
          id: toastIds.numberDealWarningPlayers(roomId),
          title: "プレイヤー数を確認しています…",
          description: "現在はホストのみ検出中ですがそのまま開始します。",
          type: "info",
          duration: 2000,
        });
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

      traceAction("ui.host.quickStart.result", {
        roomId,
        ok: result.ok ? "1" : "0",
        requestId: result.requestId,
        reason: result.ok ? "ok" : result.reason,
        status: result.ok ? undefined : String(result.status ?? -1),
        errorCode: result.ok ? undefined : result.errorCode ?? undefined,
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
        } else if (result.reason === "presence-not-ready") {
          notify({
            id: toastIds.genericInfo(roomId, "quickstart-presence"),
            title: "参加者の接続を確認しています",
            description: "数秒後にもう一度お試しください",
            type: "info",
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
        } else if (result.reason === "not-waiting") {
          notify({
            id: toastIds.genericInfo(roomId, "room-not-waiting"),
            title: "待機状態に戻るまで開始できません",
            description:
              typeof result.roomStatus === "string"
                ? `現在の状態: ${result.roomStatus}`
                : undefined,
            type: "warning",
            duration: 2200,
          });
        } else if (result.reason === "rate-limited") {
          notify({
            id: toastIds.genericInfo(roomId, "quickstart-rate-limited"),
            title: "少し待ってから再試行してください",
            description: "短時間に複数の開始要求が重なりました。",
            type: "info",
            duration: 2400,
          });
        } else if (result.reason === "auth-error") {
          notify({
            id: toastIds.genericInfo(roomId, "quickstart-auth"),
            title: "認証を更新できませんでした",
            description: "ブラウザを再読み込みして再試行してください。",
            type: "error",
            duration: 2600,
          });
        } else if (result.reason === "callable-error") {
          const status =
            typeof result.status === "number" ? result.status : undefined;
          const code = result.errorCode ?? "unknown";
          const isVersionMismatch =
            code === "room/join/version-mismatch" ||
            code === "client_version_required" ||
            code === "room/create/update-required" ||
            code === "room/create/version-mismatch";
          const debugBits = [
            typeof status === "number" ? `status:${status}` : null,
            code ? `code:${code}` : null,
            `reason:${result.reason}`,
          ].filter((x): x is string => typeof x === "string" && x.length > 0);
          notify({
            id: toastIds.genericInfo(roomId, "quickstart-callable-error"),
            title: isVersionMismatch ? "更新が必要です" : "ゲーム開始に失敗しました",
            description: isVersionMismatch
              ? `メインメニューで「更新を適用」後に再読み込みしてください。（${debugBits.join(", ")}）`
              : result.errorCode === "failed-precondition"
                ? `少し待ってから再度お試しください（${debugBits.join(", ")}）`
                : debugBits.length > 0
                  ? debugBits.join(" / ")
                  : "少し待ってから再度お試しください",
            type: isVersionMismatch ? "error" : "warning",
            duration: 2400,
          });
        } else {
          notify({
            id: toastIds.genericInfo(roomId, "quickstart-unknown"),
            title: "ゲーム開始に失敗しました",
            description: `reason: ${result.reason}`,
            type: "error",
            duration: 2600,
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
      title: i.hint ?? i.reason,
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
