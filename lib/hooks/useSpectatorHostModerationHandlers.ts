"use client";

import { notify } from "@/components/ui/notify";
import type { SpectatorHostRequest } from "@/lib/spectator/v2/useSpectatorHostQueue";
import { traceAction, traceError } from "@/lib/utils/trace";
import { useCallback } from "react";

const SPECTATOR_HOST_ERROR_MESSAGES: Record<string, string> = {
  "auth-required": "認証情報が無効です。再度ログインしてください。",
  unauthorized: "認証情報が無効です。再度ログインしてください。",
  forbidden: "承認操作を行えるのはホストのみです。",
  "rejoin-not-pending": "この申請はすでに処理されています。",
  "viewer-mismatch": "観戦者情報の確認に失敗しました。再読み込みしてください。",
  "room-mismatch": "申請対象のルームが一致しません。",
  "session-not-found": "申請セッションが見つかりませんでした。",
};

const formatSpectatorHostError = (code: string): string => {
  if (!code) {
    return "処理に失敗しました。時間をおいて再度お試しください。";
  }
  const normalized = code.toLowerCase();
  return (
    SPECTATOR_HOST_ERROR_MESSAGES[normalized] ??
    "処理に失敗しました。時間をおいて再度お試しください。"
  );
};

type UseSpectatorHostModerationHandlersParams = {
  roomId: string;
  approveSpectatorRejoin: (sessionId: string) => Promise<void>;
  rejectSpectatorRejoin: (sessionId: string, reason: string | null) => Promise<void>;
  resolveSpectatorDisplayName: (uid: string | null) => string;
};

export function useSpectatorHostModerationHandlers(params: UseSpectatorHostModerationHandlersParams) {
  const { roomId, approveSpectatorRejoin, rejectSpectatorRejoin, resolveSpectatorDisplayName } = params;

  const handleSpectatorApprove = useCallback(
    async (request: SpectatorHostRequest) => {
      try {
        await approveSpectatorRejoin(request.sessionId);
        traceAction("spectatorV2.host.approve", {
          roomId,
          sessionId: request.sessionId,
          viewerUid: request.viewerUid ?? null,
          source: request.source,
        });
        notify({
          type: "success",
          title: "復帰を承認しました",
          description: `${resolveSpectatorDisplayName(request.viewerUid)} が席へ戻ります。`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        traceError("spectatorV2.host.approve", error, {
          roomId,
          sessionId: request.sessionId,
          viewerUid: request.viewerUid ?? null,
        });
        notify({
          type: "error",
          title: "復帰の承認に失敗しました",
          description: formatSpectatorHostError(message),
        });
        throw error;
      }
    },
    [approveSpectatorRejoin, resolveSpectatorDisplayName, roomId]
  );

  const handleSpectatorReject = useCallback(
    async (request: SpectatorHostRequest, reason: string | null) => {
      try {
        await rejectSpectatorRejoin(request.sessionId, reason ?? null);
        traceAction("spectatorV2.host.reject", {
          roomId,
          sessionId: request.sessionId,
          viewerUid: request.viewerUid ?? null,
          source: request.source,
          hasReason: Boolean(reason && reason.trim().length > 0),
        });
        notify({
          type: "info",
          title: "復帰申請を見送りました",
          description:
            reason && reason.trim().length > 0
              ? `${resolveSpectatorDisplayName(request.viewerUid)} に理由を伝えました。`
              : `${resolveSpectatorDisplayName(request.viewerUid)} へ見送りを通知しました。`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        traceError("spectatorV2.host.reject", error, {
          roomId,
          sessionId: request.sessionId,
          viewerUid: request.viewerUid ?? null,
        });
        notify({
          type: "error",
          title: "復帰申請の見送りに失敗しました",
          description: formatSpectatorHostError(message),
        });
        throw error;
      }
    },
    [rejectSpectatorRejoin, resolveSpectatorDisplayName, roomId]
  );

  return { handleSpectatorApprove, handleSpectatorReject } as const;
}
