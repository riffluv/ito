import type { HostActionsController } from "@/lib/host/HostActionsController";
import { toastIds } from "@/lib/ui/toastIds";
import { traceAction } from "@/lib/utils/trace";
import { notify } from "@/components/ui/notify";

type QuickStartResult = Awaited<ReturnType<HostActionsController["quickStartWithTopic"]>>;
type QuickStartFailureResult = Extract<QuickStartResult, { ok: false }>;

export function handleQuickStartFailure(params: {
  roomId: string;
  roomStatus?: string;
  result: QuickStartFailureResult;
  attempts: number;
  ensurePresenceReady: () => void;
  setCustomStartPending: (value: boolean) => void;
  setCustomText: (value: string) => void;
  setCustomOpen: (value: boolean) => void;
}): void {
  const {
    roomId,
    roomStatus,
    result,
    attempts,
    ensurePresenceReady,
    setCustomStartPending,
    setCustomText,
    setCustomOpen,
  } = params;

  const failureCategory = (() => {
    if (result.reason === "auth-error") return "auth";
    if (result.reason === "rate-limited") return "rate_limited";
    if (result.reason === "presence-not-ready") return "presence";
    if (result.reason === "not-waiting") return "invalid_status";
    if (result.reason === "host-mismatch") return "forbidden";
    if (result.reason === "needs-custom-topic") return "needs_custom_topic";
    if (result.reason === "callable-error") {
      const code = result.errorCode ?? "";
      if (
        code === "room/join/version-mismatch" ||
        code === "client_version_required" ||
        code === "room/create/update-required" ||
        code === "room/create/version-mismatch"
      ) {
        return "version-mismatch";
      }
      if (typeof result.status !== "number") {
        const msg = (result.errorMessage ?? "").toLowerCase();
        if (msg.includes("failed to fetch") || msg.includes("network")) {
          return "network";
        }
      }
      if (result.status === 401) return "auth";
      return "api";
    }
    return "unknown";
  })();

  // 失敗理由を明示的にログ出力（デバッグ用）
  traceAction("ui.host.quickStart.failed", {
    roomId,
    requestId: result.requestId,
    reason: result.reason,
    category: failureCategory,
    roomStatus: result.roomStatus ?? undefined,
    status: typeof result.status === "number" ? String(result.status) : undefined,
    errorCode: result.errorCode ?? undefined,
    attempts: String(attempts),
  });
  console.warn("[quickStart] failed:", result.reason, {
    roomId,
    requestId: result.requestId,
    roomStatus: result.roomStatus,
    status: result.status,
    url: result.url,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    details: result.details,
  });

  if (result.reason === "presence-not-ready") {
    ensurePresenceReady();
  } else if (result.reason === "rate-limited") {
    notify({
      id: toastIds.genericInfo(roomId, "quickstart-rate-limited"),
      title: "少し間をおいて再試行しています…",
      description: "短時間に複数の開始要求が重なりました。",
      type: "info",
      duration: 1600,
    });
  } else if (result.reason === "host-mismatch") {
    notify({
      id: toastIds.genericInfo(roomId, "host-mismatch"),
      title: "ホスト権限の確定を待っています",
      description: "権限が移動した直後は数秒後にもう一度お試しください",
      type: "warning",
      duration: 2600,
    });
  } else if (result.reason === "auth-error") {
    notify({
      id: toastIds.genericInfo(roomId, "quickstart-auth"),
      title: "認証を更新できませんでした",
      description: "ブラウザを再読み込みして再試行してください。",
      type: "error",
      duration: 2600,
    });
  } else if (result.reason === "needs-custom-topic") {
    setCustomStartPending(true);
    setCustomText("");
    setCustomOpen(true);
  } else if (result.reason === "functions-unavailable") {
    throw new Error("firebase-functions-unavailable");
  } else if (result.reason === "not-waiting") {
    const currentStatus = result.roomStatus ?? roomStatus ?? "unknown";
    notify({
      id: toastIds.genericInfo(roomId, "quickstart-not-waiting-failed"),
      title: "ゲームを開始できませんでした",
      description: `前のラウンドが終了処理中の可能性があります。数秒後にもう一度お試しください。（status: ${currentStatus}）`,
      type: "warning",
      duration: 2600,
    });
  } else if (result.reason === "callable-error") {
    const status = typeof result.status === "number" ? result.status : undefined;
    const code = result.errorCode ?? "unknown";
    const isNetworkError =
      status === undefined && Boolean((result.errorMessage ?? "").match(/failed to fetch|network/i));
    const isVersionMismatch =
      code === "room/join/version-mismatch" ||
      code === "client_version_required" ||
      code === "room/create/update-required" ||
      code === "room/create/version-mismatch";

    const mismatchType =
      typeof (result.details as { mismatchType?: unknown } | null)?.mismatchType === "string"
        ? (result.details as { mismatchType: string }).mismatchType
        : null;
    const mismatchHint =
      mismatchType === "client_outdated"
        ? "（この端末の更新が古い可能性があります）"
        : mismatchType === "room_outdated"
          ? "（作成直後に更新が入った可能性があります）"
          : "";

    const debugBits = [
      typeof status === "number" ? `status:${status}` : null,
      code ? `code:${code}` : null,
      `reason:${result.reason}`,
    ].filter((x): x is string => typeof x === "string" && x.length > 0);

    if (isVersionMismatch) {
      notify({
        id: toastIds.genericInfo(roomId, "quickstart-version-mismatch"),
        title: "更新が必要です",
        description: `メインメニューで「更新を適用」後に再読み込みしてください。${mismatchHint}（${debugBits.join(", ")}）`,
        type: "error",
        duration: 4200,
      });
    } else if (status === 401 || code === "unauthorized") {
      notify({
        id: toastIds.genericInfo(roomId, "quickstart-unauthorized"),
        title: "認証が必要です",
        description: `再読み込みしてから再試行してください。（${debugBits.join(", ")}）`,
        type: "error",
        duration: 3600,
      });
    } else if (isNetworkError) {
      notify({
        id: toastIds.genericInfo(roomId, "quickstart-network"),
        title: "通信に失敗しました",
        description: `通信状態を確認して再試行してください。（${debugBits.join(", ")}）`,
        type: "error",
        duration: 3400,
      });
    } else {
      const hint =
        status === 409
          ? "状態が更新中の可能性があります。数秒待って再試行してください。"
          : "しばらく待って再試行してください。";
      notify({
        id: toastIds.genericInfo(roomId, "quickstart-callable-error"),
        title: "ゲーム開始に失敗しました",
        description: `${hint}（${debugBits.join(", ")}）`,
        type: "error",
        duration: 3600,
      });
    }
  } else {
    notify({
      id: toastIds.genericInfo(roomId, "quickstart-unknown"),
      title: "ゲーム開始に失敗しました",
      description: `reason: ${result.reason}`,
      type: "error",
      duration: 3200,
    });
  }
}
