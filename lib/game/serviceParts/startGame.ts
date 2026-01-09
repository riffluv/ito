import { withPermissionRetry } from "@/lib/firebase/permissionGuard";
import { traceAction, traceError } from "@/lib/utils/trace";
import { apiStartGame } from "@/lib/services/roomApiClient";
import type { StartGameOptions } from "@/lib/game/serviceParts/types";

export async function startGame(
  roomId: string,
  requestId: string,
  sessionIdOrOpts?: string | null | StartGameOptions
) {
  const opts =
    typeof sessionIdOrOpts === "string" ||
    sessionIdOrOpts === null ||
    sessionIdOrOpts === undefined
      ? { sessionId: sessionIdOrOpts }
      : sessionIdOrOpts ?? {};

  traceAction("host.start", { roomId });
  try {
    return await withPermissionRetry(
      () =>
        apiStartGame(roomId, {
          requestId,
          sessionId: opts.sessionId ?? undefined,
          allowFromFinished: opts.allowFromFinished,
          allowFromClue: opts.allowFromClue,
          autoDeal: opts.autoDeal,
          topicType: opts.topicType,
          customTopic: opts.customTopic,
        }),
      { context: "host.start", toastContext: "ゲーム開始" }
    );
  } catch (error) {
    traceError("host.start", error, { roomId });
    throw error;
  }
}

