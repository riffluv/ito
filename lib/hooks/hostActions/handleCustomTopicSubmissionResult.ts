import type { HostActionsController } from "@/lib/host/HostActionsController";
import { toastIds } from "@/lib/ui/toastIds";
import { notify } from "@/components/ui/notify";

type CustomTopicResult = Awaited<ReturnType<HostActionsController["submitCustomTopicAndStartIfNeeded"]>>;

export function handleCustomTopicSubmissionResult(params: {
  roomId: string;
  shouldAutoStart: boolean;
  result: CustomTopicResult;
  ensurePresenceReady: () => void;
}): boolean {
  const { roomId, shouldAutoStart, result, ensurePresenceReady } = params;

  if (!shouldAutoStart) {
    notify({
      id: toastIds.topicChangeSuccess(roomId),
      title: "お題を更新しました",
      description: "ホストが開始するとゲームがスタートします",
      type: "success",
      duration: 1800,
    });
    return false;
  }

  if (result && "ok" in result && result.ok === false) {
    if (result.reason === "presence-not-ready") {
      ensurePresenceReady();
    } else if (result.reason === "host-mismatch") {
      notify({
        id: toastIds.genericInfo(roomId, "host-mismatch"),
        title: "ホスト権限の確定を待っています",
        description: "権限が移動した直後は数秒後にもう一度お試しください",
        type: "warning",
        duration: 2600,
      });
    }
    return false;
  }

  if ((result as { started?: boolean })?.started === false) {
    notify({
      id: toastIds.topicChangeSuccess(roomId),
      title: "お題を更新しました",
      description: "ホストが開始するとゲームがスタートします",
      type: "success",
      duration: 1800,
    });
    return false;
  }

  return true;
}

