export type SubmitOrderErrorInfo = {
  code: string | null;
  status: number | null;
  reason: string | null;
  url: string | null;
  description: string;
};

export function describeSubmitOrderError(error: unknown): SubmitOrderErrorInfo {
  const apiError = error as {
    code?: unknown;
    status?: unknown;
    details?: unknown;
    url?: unknown;
  };
  const code = typeof apiError?.code === "string" ? apiError.code : null;
  const status = typeof apiError?.status === "number" ? apiError.status : null;
  const reason =
    typeof (apiError?.details as { reason?: unknown } | null)?.reason === "string"
      ? (apiError.details as { reason: string }).reason
      : null;
  const url = typeof apiError?.url === "string" ? apiError.url : null;

  const description = (() => {
    if (code === "timeout") {
      return "通信がタイムアウトしました。数秒待ってからもう一度お試しください。";
    }
    if (code === "unauthorized") {
      return "認証の準備中です。数秒待ってからもう一度お試しください。";
    }
    if (code === "forbidden") {
      return "ホスト権限が必要です。";
    }
    if (code === "invalid_status") {
      return "進行状態が更新されました。画面が切り替わらない場合は少し待ってからもう一度お試しください。";
    }
    if (code === "room/join/version-mismatch") {
      return "別バージョンで動作している可能性があります。ページを更新してからやり直してください。";
    }
    if (code === "invalid_payload") {
      return "提出枚数や並び順を確認して、もう一度お試しください。";
    }
    if (status === 429) {
      return "短時間に操作が集中しました。少し待ってからもう一度お試しください。";
    }
    const message = error instanceof Error ? error.message : "";
    if (message && (!code || message !== code)) return message;
    return "提出枚数や並び順を確認して、もう一度お試しください。";
  })();

  return {
    code,
    status,
    reason,
    url,
    description,
  };
}

