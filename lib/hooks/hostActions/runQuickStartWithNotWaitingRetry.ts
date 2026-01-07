import type { HostActionsController } from "@/lib/host/HostActionsController";
import { toastIds } from "@/lib/ui/toastIds";
import { traceAction, traceError } from "@/lib/utils/trace";
import { notify } from "@/components/ui/notify";

type QuickStartResult = Awaited<ReturnType<HostActionsController["quickStartWithTopic"]>>;

export async function runQuickStartWithNotWaitingRetry(params: {
  hostActions: HostActionsController;
  roomId: string;
  roomStatus?: string;
  defaultTopicType: string;
  presenceReady: boolean;
  onlineUids?: string[] | null | undefined;
  playerCount: number;
  currentTopic?: string | null;
  isRestartFlow: boolean;
  roundIds?: string[] | null;
}): Promise<{ result: QuickStartResult; attempts: number }> {
  const {
    hostActions,
    roomId,
    roomStatus,
    defaultTopicType,
    presenceReady,
    onlineUids,
    playerCount,
    currentTopic,
    isRestartFlow,
    roundIds,
  } = params;

  let attempts = 0;
  let result = await hostActions.quickStartWithTopic({
    roomId,
    roomStatus,
    defaultTopicType,
    presenceInfo: {
      presenceReady,
      onlineUids,
      playerCount,
    },
    currentTopic,
    allowFromFinished: isRestartFlow,
  });

  // 409 invalid_status → reason: not-waiting を明示的に処理。
  // allowFromFinished=true でリトライすることで、Firestore 伝播のレース条件を回避。
  const MAX_RETRY_ATTEMPTS = 3;
  while (!result.ok && result.reason === "not-waiting" && attempts < MAX_RETRY_ATTEMPTS) {
    attempts += 1;
    const currentStatus = result.roomStatus ?? roomStatus ?? "unknown";
    traceAction("ui.host.quickStart.notWaiting", {
      roomId,
      status: currentStatus,
      attempt: String(attempts),
    });
    notify({
      id: toastIds.genericInfo(roomId, "quickstart-not-waiting"),
      title: "前のラウンドを待機状態に戻しています…",
      description: "少し待って再開します。",
      type: "info",
      duration: 1800,
    });

    // 進行中ステータスが残っている場合は待機リセットを実行
    let resetSucceeded = false;
    if (!currentStatus || currentStatus === "finished" || currentStatus === "reveal" || currentStatus === "clue") {
      try {
        await hostActions.resetRoomToWaitingWithPrune({
          roomId,
          roundIds,
          onlineUids,
          includeOnline: false,
          recallSpectators: false,
        });
        resetSucceeded = true;
      } catch (error) {
        traceError("ui.host.quickStart.notWaitingReset", error, { roomId });
        // リセット失敗をユーザーに通知（握りつぶさない）
        console.warn("[quickStart] reset failed during retry", error);
        notify({
          id: toastIds.genericInfo(roomId, "quickstart-reset-failed"),
          title: "リセット処理に問題が発生しました",
          description: "もう一度お試しください。改善しない場合はページを再読み込みしてください。",
          type: "warning",
          duration: 3000,
        });
      }
    }

    // Firestore の伝播を待つ（リトライ回数に応じて待ち時間を増加）
    // リセット失敗時は待ち時間を長めに取る
    const baseWaitMs = resetSucceeded ? 700 : 1200;
    const waitMs = baseWaitMs + attempts * 350;
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    // リトライ時は allowFromFinished=true + allowFromClue=true でレース条件に対応
    result = await hostActions.quickStartWithTopic({
      roomId,
      roomStatus,
      defaultTopicType,
      presenceInfo: {
        presenceReady,
        onlineUids,
        playerCount,
      },
      currentTopic,
      allowFromFinished: true,
      allowFromClue: true,
    });
  }

  return { result, attempts };
}

