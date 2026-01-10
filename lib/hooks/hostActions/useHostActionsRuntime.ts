import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { useHostSession } from "@/lib/hooks/useHostSession";
import {
  createHostActionsController,
  type HostActionsController,
} from "@/lib/host/HostActionsController";
import { useActionCooldown } from "@/lib/hooks/hostActions/useActionCooldown";
import { useHostActionMetrics } from "@/lib/hooks/hostActions/useHostActionMetrics";
import { useHostActionRoomStatusSync } from "@/lib/hooks/hostActions/useHostActionRoomStatusSync";
import { useHostActionStatusVersionSync } from "@/lib/hooks/hostActions/useHostActionStatusVersionSync";
import { useHostActionTimersCleanup } from "@/lib/hooks/hostActions/useHostActionTimersCleanup";
import { usePendingVisibilityKick } from "@/lib/hooks/hostActions/usePendingVisibilityKick";
import { usePresenceStartGate } from "@/lib/hooks/hostActions/usePresenceStartGate";
import { useResetUiHold } from "@/lib/hooks/hostActions/useResetUiHold";
import { setMetric } from "@/lib/utils/metrics";
import { getAuth } from "firebase/auth";
import {
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";

export type HostActionsRuntime = ReturnType<typeof useHostActionsRuntime>;

export function useHostActionsRuntime(params: {
  roomId: string;
  roomStatus?: string;
  statusVersion?: number | null;
  quickStartPending: boolean;
  isRestarting: boolean;
  setQuickStartPending: Dispatch<SetStateAction<boolean>>;
  setIsRestarting: Dispatch<SetStateAction<boolean>>;
  presenceReady: boolean;
  presenceDegraded: boolean;
  playerCount?: number;
}) {
  const actionLatencyRef = useRef<Record<string, number>>({});
  const lastActionAtRef = useRef<Record<string, number>>({});
  const pendingVisibilityKickAtRef = useRef<number>(0);
  const mountedRef = useRef(true);

  const latestRoomStatusRef = useLatestRef(params.roomStatus);
  const quickStartPendingRef = useLatestRef(params.quickStartPending);
  const isRestartingRef = useLatestRef(params.isRestarting);

  const quickStartStuckTimerRef = useRef<number | null>(null);
  const quickStartEarlySyncTimerRef = useRef<number | null>(null);
  const quickStartOkAtRef = useRef<number | null>(null);

  const nextGameStuckTimerRef = useRef<number | null>(null);
  const nextGameEarlySyncTimerRef = useRef<number | null>(null);
  const nextGameOkAtRef = useRef<number | null>(null);

  const resetOkAtRef = useRef<number | null>(null);
  const resetStuckTimerRef = useRef<number | null>(null);
  const resetEarlySyncTimerRef = useRef<number | null>(null);

  const latestStatusVersionRef = useRef<number>(
    normalizeStatusVersion(params.statusVersion)
  );
  const expectedStatusVersionRef = useRef<{
    quickStart: number | null;
    nextGame: number | null;
    reset: number | null;
  }>({ quickStart: null, nextGame: null, reset: null });

  const auth = getAuth();
  const { sessionId, ensureSession } = useHostSession(params.roomId, async () => {
    const idToken = await auth?.currentUser?.getIdToken();
    return idToken ?? null;
  });

  const hostActions = useMemo<HostActionsController>(
    () =>
      createHostActionsController({
        getSessionId: () => sessionId,
        ensureSession,
      }),
    [ensureSession, sessionId]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useHostActionStatusVersionSync({
    statusVersion: params.statusVersion,
    latestStatusVersionRef,
    expectedStatusVersionRef,
    resetOkAtRef,
    quickStartOkAtRef,
    nextGameOkAtRef,
  });

  usePendingVisibilityKick({
    roomId: params.roomId,
    latestRoomStatusRef,
    quickStartPendingRef,
    isRestartingRef,
    pendingVisibilityKickAtRef,
  });

  useHostActionTimersCleanup({
    quickStartStuckTimerRef,
    quickStartEarlySyncTimerRef,
    nextGameStuckTimerRef,
    nextGameEarlySyncTimerRef,
    resetStuckTimerRef,
    resetEarlySyncTimerRef,
  });

  useHostActionRoomStatusSync({
    roomStatus: params.roomStatus,
    quickStartStuckTimerRef,
    quickStartEarlySyncTimerRef,
    nextGameStuckTimerRef,
    nextGameEarlySyncTimerRef,
    resetStuckTimerRef,
    resetEarlySyncTimerRef,
    expectedStatusVersionRef,
    resetOkAtRef,
    quickStartOkAtRef,
    nextGameOkAtRef,
    setQuickStartPending: params.setQuickStartPending,
    setIsRestarting: params.setIsRestarting,
  });

  const { markActionStart, finalizeAction, abortAction } = useHostActionMetrics({
    actionLatencyRef,
  });

  // Host-only start confirmation sound. Global start cue is controlled in Showtime (currently muted).
  const playOrderConfirm = useSoundEffect("order_confirm");
  const playResetGame = useSoundEffect("reset_game");

  const {
    presenceForceEligible,
    presenceCanStart,
    presenceWaitRemainingMs,
    ensurePresenceReady,
  } = usePresenceStartGate({
    roomId: params.roomId,
    presenceReady: params.presenceReady,
    presenceDegraded: params.presenceDegraded,
    playerCount: params.playerCount,
  });

  useEffect(() => {
    expectedStatusVersionRef.current = { quickStart: null, nextGame: null, reset: null };
    setMetric("hostAction", "quickStart.expectedStatusVersion", null);
    setMetric("hostAction", "nextGame.expectedStatusVersion", null);
    setMetric("hostAction", "reset.expectedStatusVersion", null);
  }, [params.roomId]);

  const { resetUiPending, beginResetUiHold, clearResetUiHold } = useResetUiHold({
    roomStatus: params.roomStatus,
  });

  const canProceed = useActionCooldown({ cooldownMs: 420, lastActionAtRef });

  return {
    hostActions,
    mountedRef,
    lastActionAtRef,
    latestRoomStatusRef,
    latestStatusVersionRef,
    expectedStatusVersionRef,
    quickStartStuckTimerRef,
    quickStartEarlySyncTimerRef,
    quickStartOkAtRef,
    nextGameStuckTimerRef,
    nextGameEarlySyncTimerRef,
    nextGameOkAtRef,
    resetOkAtRef,
    resetStuckTimerRef,
    resetEarlySyncTimerRef,
    canProceed,
    markActionStart,
    finalizeAction,
    abortAction,
    playOrderConfirm,
    playResetGame,
    presenceForceEligible,
    presenceCanStart,
    presenceWaitRemainingMs,
    ensurePresenceReady,
    resetUiPending,
    beginResetUiHold,
    clearResetUiHold,
  };
}

function useLatestRef<T>(value: T) {
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  return valueRef;
}

function normalizeStatusVersion(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

