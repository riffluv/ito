import { apiNextRound, type ApiError } from "@/lib/services/roomApiClient";
import { postRoundReset } from "@/lib/utils/broadcast";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  generateRequestId,
  getErrorMessage,
  isTransientNetworkError,
  sleep,
} from "@/lib/host/hostActionsControllerHelpers";
import { filterPresenceUids, mapNextRoundFailureReason } from "@/lib/host/nextRound/helpers";

type PresenceInfo = {
  presenceReady?: boolean;
  onlineUids?: (string | null | undefined)[] | null;
  playerCount?: number;
};

export type NextRoundRequest = {
  roomId: string;
  topicType?: string | null;
  customTopic?: string | null;
  presenceInfo?: PresenceInfo;
};

export type NextRoundApiResult =
  | {
      ok: true;
      requestId: string;
      round: number;
      playerCount: number;
      topic: string | null;
      topicType: string | null;
    }
  | {
      ok: false;
      requestId: string;
      reason: ReturnType<typeof mapNextRoundFailureReason>;
      status?: number;
      url?: string;
      method?: string;
      details?: unknown;
      errorCode?: string;
      errorMessage?: string;
    };

type NextRoundDeps = {
  apiNextRoundImpl?: typeof apiNextRound;
  resolveSessionId: () => Promise<string | null>;
};

// ============================================================================
// nextRound: 「次のゲーム」専用 API を呼び出す
// ============================================================================
// reset + start + topic選択 + deal をアトミックに実行する。
// 従来の restartRound (= reset + quickStartWithTopic) を置き換える。
// ============================================================================
export function createNextRound(deps: NextRoundDeps) {
  const apiNextRoundImpl = deps.apiNextRoundImpl ?? apiNextRound;
  const resolveSessionId = deps.resolveSessionId;

  return async (req: NextRoundRequest): Promise<NextRoundApiResult> => {
    const { roomId, topicType, customTopic } = req;
    const requestId = generateRequestId();
    const sessionId = await resolveSessionId();

    traceAction("ui.host.nextRound.api", {
      roomId,
      requestId,
      topicType: topicType ?? "default",
      hasCustomTopic: customTopic ? "1" : "0",
    });

    try {
      const presenceUids = filterPresenceUids(req.presenceInfo?.onlineUids);
      const run = () =>
        apiNextRoundImpl(roomId, {
          topicType,
          customTopic,
          requestId,
          sessionId,
          presenceUids,
        });

      let result: Awaited<ReturnType<typeof run>>;
      try {
        result = await run();
      } catch (error) {
        if (!isTransientNetworkError(error)) {
          throw error;
        }
        // minimized/復帰直後など、一時的な通信断で fetch が落ちることがあるため 1 回だけリトライする（requestId は同一）
        // server 側は requestId で idempotent なので、二重実行を避けられる。
        traceAction("ui.host.nextRound.retry", {
          roomId,
          requestId,
          message: getErrorMessage(error),
        });
        await sleep(650);
        result = await run();
      }

      // broadcast でラウンドリセットを通知
      try {
        postRoundReset(roomId);
      } catch {
        // broadcast failure is non-fatal
      }

      return {
        ok: true,
        requestId,
        round: result.round,
        playerCount: result.playerCount,
        topic: result.topic,
        topicType: result.topicType,
      };
    } catch (error) {
      const apiError = error as ApiError;
      const code = apiError?.code ?? null;
      const status = typeof apiError?.status === "number" ? apiError.status : undefined;
      const url = typeof apiError?.url === "string" ? apiError.url : undefined;
      const method = typeof apiError?.method === "string" ? apiError.method : undefined;
      const details = apiError?.details;
      const message = getErrorMessage(error);
      if (isTransientNetworkError(error)) {
        traceAction("ui.host.nextRound.networkError", {
          roomId,
          requestId,
          code: code ?? "unknown",
          status: typeof status === "number" ? String(status) : undefined,
          url,
          method,
          message,
        });
      } else {
        traceError("ui.host.nextRound.error", error, { roomId, code });
      }

      const reason = mapNextRoundFailureReason(code);
      return {
        ok: false,
        requestId,
        reason,
        status,
        url,
        method,
        details,
        errorCode: code ?? undefined,
        errorMessage: message,
      };
    }
  };
}
