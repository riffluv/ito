import type { HostActionsController } from "@/lib/host/HostActionsController";
import { toastIds } from "@/lib/ui/toastIds";
import { notify } from "@/components/ui/notify";

type NextGameResult = Awaited<ReturnType<HostActionsController["nextRound"]>>;
type NextGameFailureResult = Extract<NextGameResult, { ok: false }>;

export function handleNextGameFailure(params: {
  roomId: string;
  result: NextGameFailureResult;
}): void {
  const { roomId, result } = params;

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
      id: toastIds.genericInfo(roomId, "nextgame-version-mismatch"),
      title: "更新が必要です",
      description: `メインメニューで「更新を適用」後に再読み込みしてください。${mismatchHint}（${debugBits.join(", ")}）`,
      type: "error",
      duration: 4200,
    });
    return;
  }
  if (status === 401 || code === "unauthorized") {
    notify({
      id: toastIds.genericInfo(roomId, "nextgame-unauthorized"),
      title: "認証が必要です",
      description: `再読み込みしてから再試行してください。（${debugBits.join(", ")}）`,
      type: "error",
      duration: 3600,
    });
    return;
  }
  if (isNetworkError) {
    notify({
      id: toastIds.genericInfo(roomId, "nextgame-network"),
      title: "通信に失敗しました",
      description: `通信状態を確認して再試行してください。（${debugBits.join(", ")}）`,
      type: "error",
      duration: 3400,
    });
    return;
  }

  if (result.reason === "forbidden") {
    notify({
      id: toastIds.genericInfo(roomId, "nextgame-forbidden"),
      title: "ホスト権限がありません",
      description: "権限が移動した可能性があります。",
      type: "warning",
      duration: 2600,
    });
  } else if (result.reason === "no_players") {
    notify({
      id: toastIds.genericInfo(roomId, "nextgame-no-players"),
      title: "プレイヤーがいません",
      description: "最低1人が入室してから開始してください。",
      type: "warning",
      duration: 2600,
    });
  } else if (result.reason === "rate-limited") {
    notify({
      id: toastIds.genericInfo(roomId, "nextgame-rate-limit"),
      title: "処理を順番待ちしています…",
      description: "短時間に複数の開始要求が重なりました。",
      type: "info",
      duration: 1600,
    });
  } else if (result.reason === "invalid_status") {
    notify({
      id: toastIds.genericInfo(roomId, "nextgame-invalid-status"),
      title: "次のゲームを開始できませんでした",
      description: `状態が更新中の可能性があります。数秒後に再試行してください。（${debugBits.join(", ")}）`,
      type: "warning",
      duration: 2600,
    });
  } else {
    notify({
      id: toastIds.genericInfo(roomId, "nextgame-failed"),
      title: "次のゲームを開始できませんでした",
      description: debugBits.length > 0 ? debugBits.join(" / ") : "もう一度お試しください。",
      type: "warning",
      duration: 2600,
    });
  }
}

