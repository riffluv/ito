import type { RoomDoc } from "@/lib/types";
import { apiStartGame, type ApiError } from "@/lib/services/roomApiClient";
import { postRoundReset } from "@/lib/utils/broadcast";
import { traceAction, traceError } from "@/lib/utils/trace";
import {
  generateRequestId,
  getErrorMessage,
  isTransientNetworkError,
  normalizeTopicType,
  safeActiveCounts,
  sleep,
} from "@/lib/host/hostActionsControllerHelpers";
import {
  buildQuickStartValidStatuses,
  filterPresenceUids,
  isHostMismatch,
  needsCustomTopic,
} from "@/lib/host/quickStartWithTopic/helpers";
import { getAuth } from "firebase/auth";
import { doc, getDoc, getDocFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

type PresenceInfo = {
  presenceReady?: boolean;
  onlineUids?: (string | null | undefined)[] | null;
  playerCount?: number;
};

export type QuickStartRequest = {
  roomId: string;
  defaultTopicType?: string | null;
  roomStatus?: RoomDoc["status"] | string | null;
  presenceInfo?: PresenceInfo;
  currentTopic?: string | null;
  customTopic?: string | null;
  /** reveal/finished 状態からの開始を許可（次のゲーム用） */
  allowFromFinished?: boolean;
  /** clue 状態からの開始を許可（リトライ時のレース条件対策） */
  allowFromClue?: boolean;
};

export type QuickStartResult =
  | {
      ok: true;
      requestId: string;
      topicType: string;
      topic: string | null;
      assignedCount?: number;
      durationMs?: number;
      activeCount: number;
      skipPresence: boolean;
    }
  | {
      ok: false;
      requestId: string;
      reason:
        | "presence-not-ready"
        | "host-mismatch"
        | "needs-custom-topic"
        | "functions-unavailable"
        | "auth-error"
        | "not-waiting"
        | "rate-limited"
        | "callable-error";
      topicType?: string;
      topic?: string | null;
      hostId?: string | null;
      activeCount?: number;
      onlineCount?: number;
      playerCount?: number;
      roomStatus?: string | null;
      status?: number;
      url?: string;
      method?: string;
      details?: unknown;
      errorCode?: string;
      errorMessage?: string;
    };

type QuickStartDeps = {
  resolveSessionId: () => Promise<string | null>;
  fetchRoomSnapshot: (roomId: string) => Promise<RoomDoc | null>;
  apiStartGameImpl?: typeof apiStartGame;
};

export function createQuickStartWithTopic(deps: QuickStartDeps) {
  const resolveSessionId = deps.resolveSessionId;
  const fetchRoomSnapshot = deps.fetchRoomSnapshot;
  const apiStartGameImpl = deps.apiStartGameImpl ?? apiStartGame;

  return async (req: QuickStartRequest): Promise<QuickStartResult> => {
    const { roomId, presenceInfo, currentTopic, customTopic } = req;
    const startRequestId = generateRequestId();
    const sessionId = await resolveSessionId();
    const { activeCount, onlineCount, playerCount } = safeActiveCounts(presenceInfo);
    const auth = getAuth();

    if (auth?.currentUser) {
      try {
        // まずキャッシュから取得し、失敗や期限切れだけ強制リフレッシュ
        const cached = await auth.currentUser.getIdToken(/* forceRefresh */ false);
        if (!cached) {
          await auth.currentUser.getIdToken(true);
        }
      } catch (error) {
        traceError("ui.host.quickStart.authRefresh", error, { roomId });
        return {
          ok: false,
          requestId: startRequestId,
          reason: "auth-error",
          activeCount,
          onlineCount,
          playerCount,
        };
      }
    }
    const presenceReady = presenceInfo?.presenceReady ?? false;
    // 2人以下のデバッグ/少人数は presence 待ちを緩和、それ以外は必須
    const skipPresence = activeCount <= 2;
    const shouldEnforcePresence = !skipPresence;

    if (shouldEnforcePresence && !presenceReady) {
      traceAction("ui.host.quickStart.presenceNotReady", {
        roomId,
        activeCount,
        onlineCount,
        playerCount,
      });
      return {
        ok: false,
        requestId: startRequestId,
        reason: "presence-not-ready",
        activeCount,
        onlineCount,
        playerCount,
      };
    }

    let effectiveType = normalizeTopicType(req.defaultTopicType);
    let topic: string | null = currentTopic ?? null;
    let hostId: string | null = null;

    if (db) {
      try {
        const ref = doc(db, "rooms", roomId);
        // できるだけサーバー最新を読んでステータスずれを防ぐ。失敗したらキャッシュでフォールバック。
        const snap = await getDocFromServer(ref).catch(() => getDoc(ref));
        const data = snap.data() as RoomDoc | undefined;
        if (data?.options?.defaultTopicType) {
          effectiveType = normalizeTopicType(data.options.defaultTopicType);
        }
        if (typeof data?.hostId === "string") {
          hostId = data.hostId;
        }
        if (typeof data?.topic === "string") {
          topic = data.topic;
        } else if (data?.topic === null) {
          topic = null;
        }
        // allowFromFinished が true の場合は reveal/finished からの開始も許可
        // allowFromClue が true の場合は clue からの開始も許可（リトライ時のレース条件対策）
        const allowFromFinished = req.allowFromFinished ?? false;
        const allowFromClue = req.allowFromClue ?? false;
        const validStatuses = buildQuickStartValidStatuses({
          allowFromFinished,
          allowFromClue,
        });
        if (typeof data?.status === "string" && !validStatuses.includes(data.status)) {
          traceAction("ui.host.quickStart.notWaiting.precheck", {
            roomId,
            status: data.status,
          });
          return {
            ok: false,
            requestId: startRequestId,
            reason: "not-waiting",
            roomStatus: data.status,
            topicType: effectiveType,
            topic,
            activeCount,
            onlineCount,
            playerCount,
          };
        }
      } catch {
        // snapshot fetch failure is non-fatal
      }
    }

    const authUid = getAuth()?.currentUser?.uid ?? null;
    if (isHostMismatch({ roomHostId: hostId, authUid })) {
      return {
        ok: false,
        requestId: startRequestId,
        reason: "host-mismatch",
        hostId,
        topicType: effectiveType,
        topic,
        activeCount,
      };
    }

    if (
      needsCustomTopic({
        topicType: effectiveType,
        customTopic,
        topic,
      })
    ) {
      return {
        ok: false,
        requestId: startRequestId,
        reason: "needs-custom-topic",
        topicType: effectiveType,
        topic,
        activeCount,
      };
    }

    let success = false;
    try {
      const relaxForNonWaiting = typeof req.roomStatus === "string" && req.roomStatus !== "waiting";
      // 一本化後のレースを極力減らすため、デフォルトで寛容に進行中ステータスも許可する。
      const allowFromFinished = req.allowFromFinished ?? true;
      // clue 状態の再開始は、waiting 以外の状態のときだけ緩和。
      const allowFromClue = req.allowFromClue ?? relaxForNonWaiting;
      traceAction("ui.host.quickStart.api", {
        roomId,
        requestId: startRequestId,
        type: effectiveType,
        skipPresence: skipPresence ? "1" : "0",
        allowFromFinished: allowFromFinished ? "1" : "0",
        allowFromClue: allowFromClue ? "1" : "0",
        roomStatus: req.roomStatus ?? undefined,
        relaxForNonWaiting: relaxForNonWaiting ? "1" : "0",
      });

      const runStart = () =>
        apiStartGameImpl(roomId, {
          allowFromFinished,
          allowFromClue,
          requestId: startRequestId,
          sessionId,
          autoDeal: true,
          topicType: effectiveType,
          customTopic: customTopic ?? topic ?? undefined,
          presenceUids: filterPresenceUids(presenceInfo?.onlineUids),
        });

      const confirmStarted = async () => {
        const room = await fetchRoomSnapshot(roomId);
        return (
          room?.status === "clue" &&
          typeof room.startRequestId === "string" &&
          room.startRequestId === startRequestId
        );
      };

      try {
        await runStart();
      } catch (error) {
        if (!isTransientNetworkError(error)) {
          throw error;
        }
        traceAction("ui.host.quickStart.retry", {
          roomId,
          requestId: startRequestId,
          message: getErrorMessage(error),
        });
        await sleep(650);
        try {
          await runStart();
        } catch (retryError) {
          const code = (retryError as Partial<ApiError> | null)?.code;
          if ((code === "rate_limited" || isTransientNetworkError(retryError)) && (await confirmStarted())) {
            traceAction("ui.host.quickStart.retry.applied", {
              roomId,
              requestId: startRequestId,
            });
          } else {
            throw retryError;
          }
        }
      }

      try {
        postRoundReset(roomId);
      } catch {}

      success = true;
      return {
        ok: true,
        requestId: startRequestId,
        topicType: effectiveType,
        topic: topic ?? null,
        assignedCount: undefined,
        durationMs: undefined,
        activeCount,
        skipPresence,
      };
    } catch (error) {
      const apiError = error as ApiError;
      const code = apiError?.code ?? null;
      const status = typeof apiError?.status === "number" ? apiError.status : undefined;
      const url = typeof apiError?.url === "string" ? apiError.url : undefined;
      const method = typeof apiError?.method === "string" ? apiError.method : undefined;
      const details = apiError?.details;
      const message = error instanceof Error ? error.message : String(error ?? "");
      traceError("ui.host.quickStart.error", error, { roomId, code });
      if (code === "rate_limited") {
        return {
          ok: false,
          requestId: startRequestId,
          reason: "rate-limited",
          topicType: effectiveType,
          topic,
          activeCount,
          onlineCount,
          playerCount,
          status,
          url,
          method,
          details,
          errorCode: code,
          errorMessage: message,
        };
      }
      if (code === "invalid_status") {
        return {
          ok: false,
          requestId: startRequestId,
          reason: "not-waiting",
          roomStatus: req.roomStatus ?? null,
          topicType: effectiveType,
          topic,
          activeCount,
          onlineCount,
          playerCount,
          status,
          url,
          method,
          details,
          errorCode: code,
          errorMessage: message,
        };
      }
      if (code === "forbidden") {
        return {
          ok: false,
          requestId: startRequestId,
          reason: "host-mismatch",
          hostId,
          topicType: effectiveType,
          topic,
          activeCount,
          onlineCount,
          playerCount,
          status,
          url,
          method,
          details,
          errorCode: code,
          errorMessage: message,
        };
      }
      return {
        ok: false,
        requestId: startRequestId,
        reason: "callable-error",
        topicType: effectiveType,
        topic,
        activeCount,
        onlineCount,
        playerCount,
        status,
        url,
        method,
        details,
        errorCode: code ?? undefined,
        errorMessage: message,
      };
    } finally {
      if (success) {
        try {
          if (typeof window !== "undefined") {
            delete window.__ITO_LAST_RESET;
          }
        } catch {}
      }
    }
  };
}
