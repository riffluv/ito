import type { Firestore } from "firebase/firestore";

import { notify } from "@/components/ui/notify";
import type { RoundStageEvent } from "@/lib/hooks/useRoundTimeline";
import type { HostActionsController } from "@/lib/host/HostActionsController";
import { toastIds } from "@/lib/ui/toastIds";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";

import { handleNextGameFailure } from "@/lib/hooks/hostActions/handleNextGameFailure";
import { scheduleNextGameSyncWatchdogs } from "@/lib/hooks/hostActions/scheduleNextGameSyncWatchdogs";

const NEXT_GAME_DEBOUNCE_MS = 800;

export async function runNextGameWithNextRoundApi(params: {
  roomId: string;
  roomStatus?: string;
  isHost: boolean;
  isRevealAnimating: boolean;
  autoStartLocked: boolean;
  quickStartPending: boolean;
  isRestarting: boolean;
  defaultTopicType?: string | null;
  currentTopic?: string | null;
  presenceReady: boolean;
  onlineUids?: string[] | null | undefined;
  playerCount?: number;
  hostActions: HostActionsController;
  db?: Firestore | null;
  latestRoomStatusRef: { current: string | null | undefined };
  nextGameEarlySyncTimerRef: { current: number | null };
  nextGameStuckTimerRef: { current: number | null };
  nextGameOkAtRef: { current: number | null };
  latestStatusVersionRef: { current: number };
  expectedStatusVersionRef: { current: { nextGame: number | null } };
  lastActionAtRef: { current: Record<string, number> };
  setIsRestarting: (value: boolean) => void;
  onStageEvent?: (event: RoundStageEvent) => void;
  beginAutoStartLock: (
    duration: number,
    options?: { broadcast?: boolean; delayMs?: number }
  ) => void;
  clearAutoStartLock: () => void;
  playOrderConfirm: () => void;
  markActionStart: (action: string) => void;
  finalizeAction: (action: string, status: "success" | "error") => void;
}): Promise<void> {
  const {
    roomId,
    roomStatus,
    isHost,
    isRevealAnimating,
    autoStartLocked,
    quickStartPending,
    isRestarting,
    defaultTopicType,
    currentTopic,
    presenceReady,
    onlineUids,
    playerCount,
    hostActions,
    db,
    latestRoomStatusRef,
    nextGameEarlySyncTimerRef,
    nextGameStuckTimerRef,
    nextGameOkAtRef,
    latestStatusVersionRef,
    expectedStatusVersionRef,
    lastActionAtRef,
    setIsRestarting,
    onStageEvent,
    beginAutoStartLock,
    clearAutoStartLock,
    playOrderConfirm,
    markActionStart,
    finalizeAction,
  } = params;

  if (!isHost || autoStartLocked || quickStartPending || isRestarting) return;
  if (roomStatus === "reveal" && isRevealAnimating) return;

  const now = Date.now();
  const last = lastActionAtRef.current["nextGame"] ?? 0;
  const elapsed = now - last;
  if (elapsed >= 0 && elapsed < NEXT_GAME_DEBOUNCE_MS) {
    traceAction("ui.host.nextGame.debounced", {
      roomId,
      elapsed,
    });
    return;
  }
  lastActionAtRef.current["nextGame"] = now;

  if (typeof window !== "undefined" && nextGameStuckTimerRef.current !== null) {
    window.clearTimeout(nextGameStuckTimerRef.current);
    nextGameStuckTimerRef.current = null;
  }

  const startedAt = typeof performance !== "undefined" ? performance.now() : null;
  setIsRestarting(true);
  onStageEvent?.("round:prepare");

  markActionStart("nextGame");
  let success = false;
  try {
    traceAction("ui.host.nextGame", { roomId, method: "nextRound-api" });
    beginAutoStartLock(3200, { broadcast: true, delayMs: 80 });
    playOrderConfirm();

    const result = await hostActions.nextRound({
      roomId,
      topicType: defaultTopicType,
      customTopic: currentTopic,
      presenceInfo: {
        presenceReady,
        onlineUids,
        playerCount,
      },
    });

    if (!result.ok) {
      traceAction("ui.host.nextGame.result", {
        roomId,
        ok: "0",
        requestId: result.requestId,
        reason: result.reason,
        status: typeof result.status === "number" ? String(result.status) : undefined,
        errorCode: result.errorCode ?? undefined,
      });
      setMetric(
        "hostAction",
        "nextGame.lastResult",
        `fail:${result.reason}:${result.status ?? "-"}:${result.errorCode ?? "-"}:${result.requestId}`
      );

      finalizeAction("nextGame", "error");
      traceAction("ui.host.nextGame.failed", {
        roomId,
        reason: result.reason,
        errorCode: result.errorCode,
      });
      console.warn(
        "[nextGame] nextRound API failed:",
        result.reason,
        result.errorMessage
      );
      handleNextGameFailure({ roomId, result });
      clearAutoStartLock();
      return;
    }

    traceAction("ui.host.nextGame.result", {
      roomId,
      ok: "1",
      requestId: result.requestId,
      round: String(result.round),
      playerCount: String(result.playerCount),
    });
    setMetric("hostAction", "nextGame.lastResult", `ok:${result.requestId}`);

    finalizeAction("nextGame", "success");
    if (typeof performance !== "undefined" && latestRoomStatusRef.current !== "clue") {
      nextGameOkAtRef.current = performance.now();
      const expectedVersion = Math.max(0, latestStatusVersionRef.current + 1);
      expectedStatusVersionRef.current.nextGame = expectedVersion;
      setMetric("hostAction", "nextGame.expectedStatusVersion", expectedVersion);
    }
    success = true;

    notify({
      id: toastIds.gameStart(roomId),
      title: "お題とカードを配布しました！",
      type: "success",
      duration: 2000,
    });

    onStageEvent?.("round:start");
    onStageEvent?.("round:end");

    scheduleNextGameSyncWatchdogs({
      roomId,
      requestId: result.requestId,
      db,
      latestRoomStatusRef,
      nextGameEarlySyncTimerRef,
      nextGameStuckTimerRef,
    });
  } catch (error) {
    clearAutoStartLock();
    finalizeAction("nextGame", "error");
    traceError("ui.host.nextGame", error, { roomId });
    console.error("❌ nextGameButton: 失敗", error);
    notify({
      id: toastIds.genericInfo(roomId, "nextgame-error"),
      title: "エラーが発生しました",
      description: "しばらく待ってからもう一度お試しください。",
      type: "error",
      duration: 3000,
    });
    onStageEvent?.("round:abort");
  } finally {
    if (!success || latestRoomStatusRef.current === "clue") {
      setIsRestarting(false);
    }
    if (startedAt !== null) {
      setMetric("hostAction", "nextGame.totalMs", Math.round(performance.now() - startedAt));
    }
  }
}

