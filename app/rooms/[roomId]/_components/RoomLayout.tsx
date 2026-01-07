"use client";

// V3: 遅延表示は不要になったため削除

// HUD は初期表示の軽量化を優先し、必要になるまで読み込まない。
// import { Hud } from "@/components/Hud";

// 中央領域はモニター・ボード・手札に絞り、それ以外の UI は周辺に配置。
// PlayBoard/TopicDisplay/PhaseTips/SortBoard removed from center to keep only monitor + board + hand
import CentralCardBoard from "@/components/CentralCardBoard";

import { AppButton } from "@/components/ui/AppButton";
import DragonQuestParty from "@/components/ui/DragonQuestParty";
import MiniHandDock from "@/components/ui/MiniHandDock";
import { MultiSessionNotice } from "@/components/ui/MultiSessionNotice";
import { SpectatorHUD } from "@/components/rooms/SpectatorHUD";
import { RoomView } from "@/components/rooms/RoomView";
import { notify } from "@/components/ui/notify";
import { useTransition } from "@/components/ui/TransitionProvider";
import UniversalMonitor from "@/components/UniversalMonitor";
import { useAuth } from "@/context/AuthContext";
import { useRoomSpectatorFlow } from "@/lib/spectator/v2/useRoomSpectatorFlow";
import {
  PRESENCE_STALE_MS,
} from "@/lib/constants/presence";
import { getDisplayMode, stripMinimalTag } from "@/lib/game/displayMode";
import {
  collectServerAssignedSeatIds,
  computeSlotCount,
} from "@/lib/game/selectors";
import { useRoomLeaveFlow } from "@/lib/hooks/useRoomLeaveFlow";
import { useRoomHostActionsUi } from "@/lib/hooks/useRoomHostActionsUi";
import { usePresenceSessionGuard } from "@/lib/hooks/usePresenceSessionGuard";
import { useSpectatorGate } from "@/lib/hooks/useSpectatorGate";
import { useRoundPreparingHold } from "@/lib/hooks/useRoundPreparingHold";
import { useRoomHostAvailability } from "@/lib/hooks/useRoomHostAvailability";
import { useHostClaimCandidateId } from "@/lib/hooks/useHostClaimCandidateId";
import { useRoomPasswordGate } from "@/lib/hooks/useRoomPasswordGate";
import { useSpectatorAutoEnterLeave } from "@/lib/hooks/useSpectatorAutoEnterLeave";
import { useSpectatorStateLogging } from "@/lib/hooks/useSpectatorStateLogging";
import { usePlayerJoinOrderTracker } from "@/lib/hooks/usePlayerJoinOrderTracker";
import { useLastKnownHostId } from "@/lib/hooks/useLastKnownHostId";
import { useRoomDisplayNameHelpers } from "@/lib/hooks/useRoomDisplayNameHelpers";
import { useRoomOptimisticSeatHold } from "@/lib/hooks/useRoomOptimisticSeatHold";
import { useRoomMeWithOptimisticPlayers } from "@/lib/hooks/useRoomMeWithOptimisticPlayers";
import { useJoinEstablished } from "@/lib/hooks/useJoinEstablished";
import { useDisplayNameGate } from "@/lib/hooks/useDisplayNameGate";
import { usePopPulse } from "@/lib/hooks/usePopPulse";
import { useRedirectGuard } from "@/lib/hooks/useRedirectGuard";
import { useRoomSelfOnlineMetric } from "@/lib/hooks/useRoomSelfOnlineMetric";
import { useHostClaimDerivations } from "@/lib/hooks/useHostClaimDerivations";
import { useRoomRevealPendingCleanup } from "@/lib/hooks/useRoomRevealPendingCleanup";
import { useSpectatorJoinStatus } from "@/lib/hooks/useSpectatorJoinStatus";
import { useCluePhaseHygiene } from "@/lib/hooks/useCluePhaseHygiene";
import { useRoomEligibleIds } from "@/lib/hooks/useRoomEligibleIds";
import { useRoomPlayerHygiene } from "@/lib/hooks/useRoomPlayerHygiene";
import type {
  RoomMachineClientEvent,
} from "@/lib/state/roomMachine";
import { useHostClaim } from "@/lib/hooks/useHostClaim";
import { useHostPruning } from "@/lib/hooks/useHostPruning";
import { useForcedExit } from "@/lib/hooks/useForcedExit";
import { useServiceWorkerUpdate } from "@/lib/hooks/useServiceWorkerUpdate";
import { useRoomShowtimeFlow } from "@/lib/hooks/useRoomShowtimeFlow";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { logInfo } from "@/lib/utils/log";
import { setMetric } from "@/lib/utils/metrics";
import { traceAction, traceError } from "@/lib/utils/trace";
import { useSpectatorSession } from "@/lib/spectator/v2/useSpectatorSession";
import {
  useSpectatorHostQueue,
  type SpectatorHostRequest,
} from "@/lib/spectator/v2/useSpectatorHostQueue";
import SentryRoomContext from "@/components/telemetry/SentryRoomContext";
import { useRoomSafeUpdateAutomation } from "@/lib/hooks/useRoomSafeUpdateAutomation";
import {
  applyServiceWorkerUpdate,
  resyncWaitingServiceWorker,
  setRequiredSwVersionHint,
} from "@/lib/serviceWorker/updateChannel";
import { Box, Text, VStack, HStack } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { APP_VERSION } from "@/lib/constants/appVersion";
import type { RoomStateSnapshot } from "./RoomStateProvider";

const SAFE_UPDATE_FORCE_APPLY_DELAY_MS = 2 * 60 * 1000;
const ROUND_PREPARING_HOLD_MS = 1200;
const HOST_UNAVAILABLE_GRACE_MS = Math.max(
  10_000,
  Math.min(PRESENCE_STALE_MS, 30_000)
);

const SPECTATOR_HOST_ERROR_MESSAGES: Record<string, string> = {
  "auth-required": "認証情報が無効です。再度ログインしてください。",
  unauthorized: "認証情報が無効です。再度ログインしてください。",
  forbidden: "承認操作を行えるのはホストのみです。",
  "rejoin-not-pending": "この申請はすでに処理されています。",
  "viewer-mismatch": "観戦者情報の確認に失敗しました。再読み込みしてください。",
  "room-mismatch": "申請対象のルームが一致しません。",
  "session-not-found": "申請セッションが見つかりませんでした。",
};

const SPECTATOR_HOST_PANEL_ENABLED = false;

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

type AuthContextValue = ReturnType<typeof useAuth>;

type LedgerSnapshot = {
  players: (PlayerDoc & { id: string })[];
  orderList: string[];
  topic: string | null;
  failed: boolean;
  roomId: string;
  myId: string;
  mvpVotes: Record<string, string> | null;
  stats: RoomDoc["stats"] | null;
};

export type RoomLayoutProps = RoomStateSnapshot & {
  roomId: string;
  router: ReturnType<typeof useRouter>;
  transition: ReturnType<typeof useTransition> | null;
  auth: AuthContextValue;
  uid: string | null;
  safeUpdateFeatureEnabled: boolean;
  idleApplyMs: number;
  setPasswordVerified: Dispatch<SetStateAction<boolean>>;
  passwordDialogOpen: boolean;
  setPasswordDialogOpen: Dispatch<SetStateAction<boolean>>;
  passwordDialogLoading: boolean;
  setPasswordDialogLoading: Dispatch<SetStateAction<boolean>>;
  passwordDialogError: string | null;
  setPasswordDialogError: Dispatch<SetStateAction<string | null>>;
};

export function RoomLayout(props: RoomLayoutProps) {
  const {
    roomId,
    router,
    transition,
    auth,
    uid,
    safeUpdateFeatureEnabled,
    idleApplyMs,
    setPasswordVerified,
    passwordDialogOpen,
    setPasswordDialogOpen,
    passwordDialogLoading,
    setPasswordDialogLoading,
    passwordDialogError,
    setPasswordDialogError,
    room: roomData,
    players,
    onlineUids,
    presenceReady,
    presenceDegraded,
    onlinePlayers,
    loading,
    isHost,
    isMember,
    detachNow,
    reattachPresence,
    leavingRef,
    joinStatus,
    phase,
    sync,
    sendRoomEvent,
    spectatorStatus: fsmSpectatorStatus,
    spectatorReason: fsmSpectatorReason,
    spectatorRequestStatus: fsmSpectatorRequestStatus,
    spectatorRequestSource: fsmSpectatorRequestSource,
    spectatorRequestCreatedAt: fsmSpectatorRequestCreatedAt,
    spectatorRequestFailure: fsmSpectatorRequestFailure,
    spectatorError: fsmSpectatorError,
    spectatorNode: fsmSpectatorNode,
  } = props;
  if (!roomData) {
    throw new Error("RoomLayout requires room data");
  }
  const room = roomData;
  const roomRequiresPassword = room?.requiresPassword ?? false;
  const roomPasswordHash = room?.passwordHash ?? null;
  const roomPasswordSalt = room?.passwordSalt ?? null;
  const { user, displayName, setDisplayName, loading: authLoading } = auth;
  const presenceSessionGuard = usePresenceSessionGuard(roomId, uid);
  const interactionEnabled = presenceSessionGuard.isActiveSession;

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { showtimeIntentHandlers } = useRoomShowtimeFlow({ roomId, room });


  const emitSpectatorEvent = useCallback(
    (event: RoomMachineClientEvent) => {
      sendRoomEvent(event);
    },
    [sendRoomEvent]
  );

  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [lastLedgerSnapshot, setLastLedgerSnapshot] = useState<LedgerSnapshot | null>(null);
  const previousRoomStatusRef = useRef<RoomDoc["status"] | null>(room.status ?? null);
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const overlayStatusRef = useRef<string | null>(null);
  const showTransitionMessage = useCallback(
    (message: string, durationMs = 3000) => {
      if (transitionTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      setTransitionMessage(message);
      if (typeof window === "undefined" || durationMs <= 0) {
        return;
      }
      transitionTimerRef.current = window.setTimeout(() => {
        transitionTimerRef.current = null;
        setTransitionMessage((current) => (current === message ? null : current));
      }, durationMs);
    },
    []
  );
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
  }, []);

  const roomStatus = room?.status ?? null;
  const recallOpen = room?.ui?.recallOpen === true;
  const spectatorRecallEnabled = recallOpen && roomStatus === "waiting";
  const spectatorHostPanelEnabled = SPECTATOR_HOST_PANEL_ENABLED;
  const canRecallSpectators =
    spectatorHostPanelEnabled && isHost && roomStatus === "waiting";
  const {
    dealRecoveryOpen,
    handleDealRecoveryDismiss,
    recallPending,
    handleSpectatorRecall,
  } = useRoomHostActionsUi({
    roomId,
    room,
    isHost,
    spectatorHostPanelEnabled,
    canRecallSpectators,
    spectatorRecallEnabled,
  });
  const spectatorHostQueue = useSpectatorHostQueue(roomId, {
    enabled: spectatorHostPanelEnabled && isHost,
  });
  const {
    requests: spectatorHostRequests,
    loading: spectatorHostLoading,
    error: spectatorHostError,
  } = spectatorHostQueue;
  const spectatorSession = useSpectatorSession({
    roomId,
    viewerUid: uid,
  });
  const { approveRejoin: approveSpectatorRejoin, rejectRejoin: rejectSpectatorRejoin } = spectatorSession.actions;


  useRoomRevealPendingCleanup({
    roomId,
    isHost,
    revealPending: room?.ui?.revealPending === true,
    roomStatus,
  });
  const { playerJoinOrderRef, joinVersion } = usePlayerJoinOrderTracker(players);
  const {
    isUpdateReady: spectatorUpdateReady,
    isApplying: spectatorUpdateApplying,
    hasError: spectatorUpdateFailed,
    phase: safeUpdatePhase,
    lastError: safeUpdateLastError,
    autoApplySuppressed: safeUpdateAutoApplySuppressed,
    autoApplyAt: safeUpdateAutoApplyAt,
    retryUpdate: retrySpectatorUpdate,
    applyUpdate: applySpectatorUpdate,
  } = useServiceWorkerUpdate();
  const { meId, meFromPlayers, optimisticMe, setOptimisticMe, me, playersWithOptimistic } =
    useRoomMeWithOptimisticPlayers({ uid, players });
  const { resolveSpectatorDisplayName, playersSignature, fallbackNames } = useRoomDisplayNameHelpers({
    players: playersWithOptimistic,
    roomHostId: room?.hostId ?? null,
    roomHostName: room?.hostName ?? null,
    uid,
    displayName,
  });
  const { joinEstablished } = useJoinEstablished({
    isMember,
    joinStatus,
    roomStatus,
    graceMs: 15000, // 15s grace to avoid transient demotion
  });
  const dealPlayers = useMemo((): string[] | null => {
    const list = room?.deal?.players;
    if (!Array.isArray(list)) {
      return null;
    }
    const filtered = list.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
    return filtered.length > 0 ? filtered : null;
  }, [room?.deal]);
  const requiredSwVersion = useMemo(() => {
    const raw = room?.requiredSwVersion;
    if (typeof raw !== "string") return "";
    return raw.trim();
  }, [room?.requiredSwVersion]);
  // NOTE: `requiredSwVersion` は過去の PWA/Safe Update 用フィールド（運用上は外部で書かれる場合がある）。
  // ルーム参加/操作の Version Contract は `room.appVersion` + server guard を唯一の真実とし、
  // ここで `requiredSwVersion` によって入室/操作をブロックしない（混同による誤案内を防ぐ）。
  const versionMismatch = false;
  const { hasWaitingUpdate, safeUpdateActive, safeUpdateAutoApplyCountdown } = useRoomSafeUpdateAutomation({
    safeUpdateFeatureEnabled,
    idleApplyMs,
    forceApplyDelayMs: SAFE_UPDATE_FORCE_APPLY_DELAY_MS,
    roomStatus: room?.status ?? null,
    versionMismatch,
    spectatorUpdateApplying,
    spectatorUpdateFailed,
    safeUpdateAutoApplyAt,
  });
  const versionMismatchBlocksAccess = false;
  const phaseMetricRef = useRef<RoomDoc["status"] | null>(null);
  const shouldBlockUpdateOverlay = false;
  useEffect(() => {
    const nextStatus = room?.status ?? null;
    if (!nextStatus) return;
    if (phaseMetricRef.current === nextStatus) return;
    phaseMetricRef.current = nextStatus;
    setMetric("phase", "status", nextStatus);
    if (typeof performance !== "undefined") {
      setMetric("phase", "transitionAt", Math.round(performance.now()));
    }
  }, [room?.status]);
  useEffect(() => {
    setMetric("room", "isHost", isHost ? 1 : 0);
  }, [isHost]);
  useEffect(() => {
    if (requiredSwVersion) {
      setMetric("app", "requiredSwVersion", requiredSwVersion);
    } else {
      setMetric("app", "requiredSwVersion", "");
    }
    setMetric("app", "versionMismatch", 0);
  }, [requiredSwVersion]);
  useEffect(() => {
    setRequiredSwVersionHint(requiredSwVersion || null);
  }, [requiredSwVersion]);
  useEffect(() => {
    return () => {
      setRequiredSwVersionHint(null);
    };
  }, []);
  const orderList = room?.order?.list;
  const roomDealPlayers = room?.deal?.players;
  const orderProposal = room?.order?.proposal;
  const roundPreparing = room?.ui?.roundPreparing === true;
  const roundPreparingHold = useRoundPreparingHold(roundPreparing, ROUND_PREPARING_HOLD_MS);
  const ledgerOrderList = useMemo(() => {
    if (!Array.isArray(orderList)) return [];
    return (orderList as (string | null | undefined)[])
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value): value is string => value.length > 0);
  }, [orderList]);
  const buildLedgerSnapshot = useCallback(
    (): LedgerSnapshot => ({
      players: playersWithOptimistic,
      orderList: ledgerOrderList,
      topic: room.topic ?? null,
      failed: !!room.order?.failed,
      roomId,
      myId: meId,
      mvpVotes: room.mvpVotes ?? null,
      stats: room.stats ?? null,
    }),
    [
      ledgerOrderList,
      meId,
      playersWithOptimistic,
      room.mvpVotes,
      room.order?.failed,
      room.stats,
      room.topic,
      roomId,
    ]
  );
  useEffect(() => {
    if (room.status !== "finished") return;
    setLastLedgerSnapshot(buildLedgerSnapshot());
  }, [room.status, buildLedgerSnapshot]);
  useEffect(() => {
    setLastLedgerSnapshot(null);
    setIsLedgerOpen(false);
    previousRoomStatusRef.current = null;
  }, [roomId]);

  const { handleRoomPasswordSubmit, handleRoomPasswordCancel } = useRoomPasswordGate({
    roomId,
    roomRequiresPassword,
    roomPasswordHash,
    roomPasswordSalt,
    router,
    setPasswordVerified,
    setPasswordDialogOpen,
    setPasswordDialogLoading,
    setPasswordDialogError,
  });

  const stableHostId =
    typeof room?.hostId === "string" ? room.hostId.trim() : "";

  const lastKnownHostId = useLastKnownHostId({
    creatorId: room?.creatorId ?? null,
    stableHostId,
  });

  const { presenceLastSeenRef, hostLikelyUnavailable } = useRoomHostAvailability({
    presenceReady,
    presenceDegraded,
    onlineUids,
    hostId: stableHostId,
    viewerUid: uid,
    graceMs: HOST_UNAVAILABLE_GRACE_MS,
  });
  useRoomSelfOnlineMetric({ uid, onlineUids });

  const { isSoloMember, previousHostStillMember } = useHostClaimDerivations({
    uid,
    isMember,
    players,
    lastKnownHostId,
    presenceReady,
    onlineUids,
  });

  const hostClaimCandidateId = useHostClaimCandidateId({
    roomId: room?.id ?? null,
    players,
    joinVersion,
    playerJoinOrderRef,
    lastKnownHostId,
    stableHostId,
    presenceReady,
    onlineUids,
    presenceLastSeenRef,
    hostLikelyUnavailable,
    graceMs: HOST_UNAVAILABLE_GRACE_MS,
  });


  const pop = usePopPulse(me?.number, 180);
  const redirectGuard = useRedirectGuard(1200);
  const [forcedExitReason, setForcedExitReason] = useState<
    "game-in-progress" | "version-mismatch" | null
  >(null);
  const {
    isSpectatorMode,
    seatRequestTimedOut,
    spectatorController,
    handleRetryJoin,
    seatAcceptanceActive,
    seatRequestPending,
    seatRequestAccepted,
    clearRejoinIntent,
    suppressAutoJoinIntent,
    cancelSeatRequestSafely,
  } = useRoomSpectatorFlow({
    roomId,
    uid,
    isHost,
    isMember,
    spectatorFsm: {
      status: fsmSpectatorStatus,
      node: fsmSpectatorNode,
      reason: fsmSpectatorReason,
      requestSource: fsmSpectatorRequestSource,
      requestStatus: fsmSpectatorRequestStatus,
      requestCreatedAt: fsmSpectatorRequestCreatedAt,
      requestFailure: fsmSpectatorRequestFailure,
      error: fsmSpectatorError,
    },
    versionMismatchBlocksAccess,
    emitSpectatorEvent,
    leavingRef,
    spectatorSession,
    spectatorRecallEnabled,
    roomStatus,
    recallOpen,
    setForcedExitReason,
    reattachPresence,
  });

  const boardMeId = isSpectatorMode ? "" : meId;
  const spectatorReason = spectatorController.state.reason;
  const seatRequestState = spectatorController.state.seatRequest;
  const hasRejoinIntent = spectatorController.utils.hasRejoinIntent;

  const { leaveRoom, handleForcedExitLeaveNow } = useRoomLeaveFlow({
    roomId,
    uid,
    displayName,
    router,
    transition,
    user,
    detachNow,
    leavingRef,
    versionMismatchBlocksAccess,
    forcedExitReason,
    setForcedExitReason,
    roomStatus,
    recallOpen,
    sendRoomEvent: emitSpectatorEvent,
  });

  const { needName, handleSubmitName } = useDisplayNameGate({ displayName, setDisplayName });





  const spectatorJoinStatus = useSpectatorJoinStatus({ joinStatus, roomStatus });
  const hasOptimisticSeat =
    !!optimisticMe &&
    (joinEstablished || seatAcceptanceActive) &&
    !(forcedExitReason || versionMismatchBlocksAccess);

  const serverAssignedSeatIds = useMemo(() => {
    return collectServerAssignedSeatIds({
      dealPlayers: room?.deal?.players ?? null,
      orderList: room?.order?.list ?? null,
      proposal: room?.order?.proposal ?? null,
    });
  }, [room?.deal?.players, room?.order?.list, room?.order?.proposal]);

  const hasServerAssignedSeat = !!(uid && serverAssignedSeatIds.has(uid));
  const {
    spectatorEnterReason,
    spectatorCandidate,
    mustSpectateMidGame,
  } = useSpectatorGate({
    roomStatus: room?.status ?? null,
    isHost,
    isMember,
    hasOptimisticSeat,
    seatAcceptanceActive,
    seatRequestPending,
    joinStatus: spectatorJoinStatus,
    loading,
    forcedExitReason,
    recallOpen,
    versionMismatchBlocksAccess,
    hasServerAssignedSeat,
    spectatorNode: fsmSpectatorNode,
  });

  useEffect(() => {
    traceAction("spectator.candidate", {
      roomId,
      uid,
      spectatorCandidate,
      joinStatus: spectatorJoinStatus,
      seatRequestPending,
      seatAcceptanceActive,
      hasOptimisticSeat,
      spectatorNode: fsmSpectatorNode,
    });
  }, [
    roomId,
    uid,
    spectatorCandidate,
    spectatorJoinStatus,
    seatRequestPending,
    seatAcceptanceActive,
    hasOptimisticSeat,
    fsmSpectatorNode,
  ]);

  useEffect(() => {
    if (!mustSpectateMidGame) return;
    if (fsmSpectatorNode !== "idle") return;
    emitSpectatorEvent({ type: "SPECTATOR_ENTER", reason: "mid-game" });
  }, [mustSpectateMidGame, fsmSpectatorNode, emitSpectatorEvent]);

  useEffect(() => {
    traceAction("spectator.gate", {
      roomId,
      status: room?.status ?? null,
      spectatorCandidate,
      mustSpectateMidGame,
      recallOpen,
      joinStatus: spectatorJoinStatus,
    });
  }, [
    roomId,
    room?.status,
    spectatorCandidate,
    mustSpectateMidGame,
    recallOpen,
    spectatorJoinStatus,
  ]);

  useSpectatorAutoEnterLeave({
    uid,
    isSpectatorMode,
    isMember,
    isHost,
    hasOptimisticSeat,
    seatRequestPending,
    seatAcceptanceActive,
    forcedExitReason,
    spectatorCandidate,
    spectatorEnterReason,
    mustSpectateMidGame,
    fsmSpectatorNode,
    emitSpectatorEvent,
  });
  const canAccess = (isMember || isHost || hasOptimisticSeat) && !versionMismatchBlocksAccess;
  useEffect(() => {
    traceAction("spectator.mode", {
      roomId,
      uid,
      isSpectatorMode,
      isMember,
      roomStatus: room?.status ?? null,
      spectatorNode: fsmSpectatorNode,
    });

    // Spectator V3: 観戦遷移時のトレースと状態初期化
    if (isSpectatorMode && uid) {
      traceAction("spectator.enter", {
        roomId,
        uid,
        reason: versionMismatchBlocksAccess
          ? "version-mismatch"
          : room?.status === "waiting"
          ? "waiting"
          : "mid-game",
      });

      // 観戦遷移時の状態初期化を厳密化
      if (optimisticMe) {
        setOptimisticMe(null);
      }
      // 他の残留状態もクリア
      if (seatRequestState.status !== "idle") {
        emitSpectatorEvent({ type: "SPECTATOR_RESET" });
      }
    }
  }, [
    roomId,
    uid,
    isSpectatorMode,
    isMember,
    room?.status,
    versionMismatchBlocksAccess,
    emitSpectatorEvent,
    seatRequestState.status,
    fsmSpectatorNode,
    optimisticMe,
    setOptimisticMe,
  ]);
  useRoomOptimisticSeatHold({
    uid,
    isSpectatorMode,
    meFromPlayers,
    me,
    joinEstablished,
    seatRequestPending,
    seatAcceptanceActive,
    seatRequestAccepted,
    displayName,
    optimisticMe,
    setOptimisticMe,
  });

  // 観戦理由の判定（文言出し分け用）
  const waitingToRejoin = roomStatus === "waiting";

  useSpectatorStateLogging({
    roomId,
    uid,
    roomStatus: room?.status ?? null,
    spectatorNode: fsmSpectatorNode,
    isMember,
    canAccess,
    forcedExitReason,
    spectatorReason,
    joinStatus,
    playersSignature,
    waitingToRejoin,
  });

  const skipForcedExit = !uid || !isMember;

  useForcedExit({
    uid,
    roomStatus: room?.status,
    canAccess,
    spectatorNode: fsmSpectatorNode,
    loading,
    authLoading,
    hasRejoinIntent,
    clearRejoinIntent,
    suppressAutoJoinIntent,
    cancelSeatRequestSafely,
    redirectGuard,
    lastKnownHostId,
    leavingRef,
    detachNow,
    setForcedExitReason,
    roomId,
    displayName,
    sendRoomEvent: emitSpectatorEvent,
    recallOpen,
    skip: skipForcedExit,
  });

  useEffect(() => {
    if (!forcedExitReason) return;
    if (!canAccess && room?.status !== "waiting") return;

    if (room?.status === "waiting") {
      leavingRef.current = false;
    }
    setForcedExitReason(null);
  }, [
    forcedExitReason,
    canAccess,
    room?.status,
    uid,
    displayName,
    leavingRef,
    setForcedExitReason,
  ]);



  const hostClaimStatus = useHostClaim({
    roomId,
    uid,
    user,
    hostId: stableHostId || null,
    hostLikelyUnavailable,
    isSoloMember,
    candidateId: hostClaimCandidateId,
    lastKnownHostId,
    previousHostStillMember,
    isMember,
    leavingRef,
  });


  useRoomPlayerHygiene({
    roomId,
    room,
    uid,
    me,
    players,
    displayName,
  });
  useEffect(() => {
    const status = room?.status ?? null;
    if (!isMember) {
      overlayStatusRef.current = status;
      if (transitionTimerRef.current !== null && typeof window !== "undefined") {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      if (transitionMessage !== null) {
        setTransitionMessage(null);
      }
      return;
    }
    const prev = overlayStatusRef.current;
    if (status && prev !== status) {
      if (prev === "waiting" && status === "clue") {
        showTransitionMessage("配られた数字にぴったりなワードを考えよう！", 3000);
      } else if (status === "waiting" && prev && prev !== "waiting") {
        if (prev === "finished") {
          showTransitionMessage("次のゲームに移行中…", 3000);
        } else {
          showTransitionMessage("リセット中…", 3000);
        }
      }
    }
    overlayStatusRef.current = status;
  }, [room?.status, isMember, showTransitionMessage, transitionMessage]);

  useHostPruning({
    isHost,
    uid,
    user,
    roomId,
    players,
    onlineUids,
    presenceReady,
  });






  const { baseIds, eligibleIds } = useRoomEligibleIds({
    room,
    players: playersWithOptimistic,
    onlineUids,
    presenceReady,
  });
  const { clueTargetIds, allCluesReady } = useCluePhaseHygiene({
    roomId,
    room,
    players,
    eligibleIds,
    isHost,
  });

  // 戦績モーダルは finished → その他 への遷移時に自動で閉じる（再オープンは手動で可）。
  useEffect(() => {
    const previousStatus = previousRoomStatusRef.current;
    const currentStatus = room.status;
    if (previousStatus === "finished" && currentStatus !== "finished" && isLedgerOpen) {
      setIsLedgerOpen(false);
    }
    previousRoomStatusRef.current = currentStatus;
  }, [room.status, isLedgerOpen]);

  const [optimisticProposalOverrides, setOptimisticProposalOverrides] = useState<
    Record<string, "placed" | "removed">
  >({});
  const sanitizedServerProposal = useMemo<(string | null)[]>(() => {
    if (!Array.isArray(orderProposal)) {
      return [];
    }
    return (orderProposal as (string | null | undefined)[]).map((value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    });
  }, [orderProposal]);
  const updateOptimisticProposalOverride = useCallback(
    (playerId: string, state: "placed" | "removed" | null) => {
      if (!playerId) return;
      setOptimisticProposalOverrides((prev) => {
        const current = prev[playerId] ?? null;
        if (current === state || (state === null && !(playerId in prev))) {
          return prev;
        }
        if (state === null) {
          const next = { ...prev };
          delete next[playerId];
          return next;
        }
        return { ...prev, [playerId]: state };
      });
    },
    []
  );
  const sanitizedServerProposalSet = useMemo(() => {
    const set = new Set<string>();
    sanitizedServerProposal.forEach((value) => {
      if (typeof value === "string" && value.length > 0) {
        set.add(value);
      }
    });
    return set;
  }, [sanitizedServerProposal]);

  useEffect(() => {
    if (!Object.keys(optimisticProposalOverrides).length) return;
    const hasServerUpdate = sanitizedServerProposalSet;
    let changed = false;
    const next: Record<string, "placed" | "removed"> = {};
    Object.entries(optimisticProposalOverrides).forEach(([playerId, state]) => {
      const presentOnServer = hasServerUpdate.has(playerId);
      if ((state === "placed" && presentOnServer) || (state === "removed" && !presentOnServer)) {
        changed = true;
        return;
      }
      next[playerId] = state;
    });
    if (changed) {
      setOptimisticProposalOverrides(next);
    }
  }, [sanitizedServerProposalSet, optimisticProposalOverrides]);
  useEffect(() => {
    if (room?.status === "clue") return;
    setOptimisticProposalOverrides((prev) => (Object.keys(prev).length ? {} : prev));
  }, [room?.status]);
  const proposalForUi = useMemo<(string | null)[]>(() => {
    const overrides = optimisticProposalOverrides;
    if (!Object.keys(overrides).length) {
      return sanitizedServerProposal;
    }
    const next = sanitizedServerProposal.slice();
    const presentSet = new Set(
      next.filter((value): value is string => typeof value === "string" && value.length > 0)
    );

    Object.entries(overrides).forEach(([playerId, state]) => {
      if (state !== "removed") return;
      for (let i = 0; i < next.length; i += 1) {
        if (next[i] === playerId) {
          next[i] = null;
        }
      }
      presentSet.delete(playerId);
    });

    Object.entries(overrides).forEach(([playerId, state]) => {
      if (state !== "placed") return;
      if (presentSet.has(playerId)) return;
      const emptyIndex = next.findIndex((slot) => slot === null);
      if (emptyIndex >= 0) {
        next[emptyIndex] = playerId;
      } else {
        next.push(playerId);
      }
      presentSet.add(playerId);
    });

    return next;
  }, [sanitizedServerProposal, optimisticProposalOverrides]);

  const slotCount = useMemo(
    () =>
      computeSlotCount({
        status: room?.status || "waiting",
        orderList: orderList ?? [],
        dealPlayers: Array.isArray(roomDealPlayers) ? roomDealPlayers : [],
        proposal: Array.isArray(orderProposal) ? orderProposal : [],
        presenceReady,
        onlineUids,
        playersCount: playersWithOptimistic.length,
        playerIds: playersWithOptimistic.map((p) => p.id),
      }),
    [
      room?.status,
      orderList,
      roomDealPlayers,
      orderProposal,
      presenceReady,
      onlineUids,
      playersWithOptimistic,
    ]
  );
  

  const submittedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    const proposal = room?.order?.proposal;
    if (Array.isArray(proposal)) {
      proposal.forEach((pid) => {
        if (typeof pid === "string" && pid.trim().length > 0) ids.add(pid);
      });
    }
    if (Array.isArray(orderList)) {
      orderList.forEach((pid) => {
        if (typeof pid === "string" && pid.trim().length > 0) ids.add(pid);
      });
    }
    return Array.from(ids);
  }, [room?.order?.proposal, orderList]);

  const canStartSorting = useMemo(() => {
    const resolveMode = room?.options?.resolveMode;
    const roomStatus = room?.status;
    if (resolveMode !== "sort-submit" || roomStatus !== "clue") return false;
    const playerMap = new Map(players.map((p) => [p.id, p]));
    const placedIds = new Set(room?.order?.proposal ?? []);
    let waitingCount = 0;
    for (const id of eligibleIds) {
      const candidate = playerMap.get(id);
      if (candidate && !placedIds.has(candidate.id)) waitingCount += 1;
    }
    return waitingCount === 0;
  }, [room?.order?.proposal, room?.options?.resolveMode, room?.status, players, eligibleIds]);

  const meHasPlacedCard = submittedPlayerIds.includes(meId);
  const playerCount = playersWithOptimistic.length;
  let baseOverlayMessage: string | null = null;
  if (room && isMember) {
    const status = room.status ?? null;
    if (status === "waiting") {
      baseOverlayMessage = `メンバー待機中（参加人数：${playerCount}人）`;
    } else if (status === "clue") {
      baseOverlayMessage = "連想ワード入力中";
    } else if (status === "reveal") {
      baseOverlayMessage = "判定中…";
    } else if (status === "finished") {
      baseOverlayMessage = "結果を確認中…";
    }
  }
  const displayRoomName = stripMinimalTag(room?.name) || "";
  const usingLedgerSnapshot = room.status !== "finished" && !!lastLedgerSnapshot;
  const ledgerData = room.status === "finished" ? buildLedgerSnapshot() : lastLedgerSnapshot;
  const effectiveLedgerData = ledgerData ?? buildLedgerSnapshot();
  // 戦績ボタン制御（MinimalChat 側のみで使用）
  const canOpenLedger = room.status === "finished" || !!lastLedgerSnapshot;
  const ledgerButtonLabel = room.status === "finished" ? "戦績を見る" : "前の戦績を見る";
  const ledgerContextLabel = usingLedgerSnapshot ? "前ラウンドの戦績を表示中" : null;
  const handleOpenLedger = useCallback(() => {
    if (room.status === "finished" || lastLedgerSnapshot) {
      setIsLedgerOpen(true);
      return;
    }
    notify({
      id: "ledger-unavailable",
      type: "info",
      title: "まだ戦績がありません",
      description: "ラウンドを1回終えると戦績を見返せます。",
    });
  }, [room.status, lastLedgerSnapshot]);

  // Layout nodes split to avoid JSX nesting pitfalls
  const headerNode = undefined;


  const sidebarNode = (
    <DragonQuestParty
      players={playersWithOptimistic}
      roomStatus={room?.status || "waiting"}
      onlineCount={onlinePlayers.length}
      onlineUids={onlineUids}
      hostId={room?.hostId}
      roomId={roomId}
      isHostUser={isHost}
      eligibleIds={baseIds}
      roundIds={baseIds}
      submittedPlayerIds={submittedPlayerIds}
      fallbackNames={fallbackNames}
      displayRoomName={displayRoomName}
      suspendTransientUpdates={joinStatus === "joining" || joinStatus === "retrying" || loading}
    />
  );

  const mainNode = (
    <Box
      h="100%"
      display="grid"
      gridTemplateRows="auto 1fr"
      gap={3}
      minH={0}
      css={{
        "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
          {
            gap: "0.5rem",
            paddingTop: "0.25rem",
          },
      }}
    >
      <Box
        p={0}
        pt={{ base: "56px", md: "64px" }}
        css={{

          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)":
            {
              paddingTop: "40px !important",
            },
        }}
      >
        <UniversalMonitor room={room} players={playersWithOptimistic} />
      </Box>
      <Box
        overflow="visible"
        minH={0}
        css={{
          "@media (max-height: 700px) and (min-resolution: 1.5dppx), screen and (max-height: 700px) and (-webkit-device-pixel-ratio: 1.5)":
            {
              overflowY: "auto",
            },
        }}
      >
        <CentralCardBoard
          roomId={roomId}
          players={playersWithOptimistic}
          orderList={room.order?.list || []}
          meId={boardMeId}
          eligibleIds={eligibleIds}
          roomStatus={room.status}
          cluesReady={allCluesReady}
          failed={!!room.order?.failed}
          proposal={proposalForUi}
          resolveMode={room.options?.resolveMode}
          displayMode={getDisplayMode(room)}
          orderNumbers={room.order?.numbers ?? {}}
          orderSnapshots={room.order?.snapshots ?? null}
          slotCount={slotCount}
          topic={room.topic ?? null}
          revealedAt={room.result?.revealedAt ?? null}
          uiRevealPending={room?.ui?.revealPending === true}
          dealPlayers={dealPlayers}
          currentStreak={room.stats?.currentStreak ?? 0}
          onOptimisticProposalChange={updateOptimisticProposalOverride}
          sendRoomEvent={sendRoomEvent}
          presenceReady={presenceReady}
          interactionEnabled={interactionEnabled}
        />
      </Box>
    </Box>
  );

  const spectatorUpdateButton = spectatorUpdateReady ? (
    <AppButton
      palette="brand"
      size="md"
      onClick={spectatorUpdateFailed ? retrySpectatorUpdate : applySpectatorUpdate}
      disabled={spectatorUpdateApplying}
    >
      {spectatorUpdateApplying
        ? "適用中..."
        : spectatorUpdateFailed
          ? "再試行"
          : "最新アップデートを適用"}
    </AppButton>
  ) : null;

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

  const showHand =
    !!me &&
    !isSpectatorMode &&
    (isMember ||
      seatAcceptanceActive ||
      (uid ? players.some((player) => player.id === uid) : false));

  const sessionNotice =
    !isSpectatorMode &&
    presenceSessionGuard.hasMultipleSessions &&
    !presenceSessionGuard.isActiveSession ? (
      <MultiSessionNotice onRequestActive={presenceSessionGuard.requestActive} />
    ) : null;

  const showRejoinOverlay =
    (seatRequestPending || seatAcceptanceActive) && !isSpectatorMode && !isMember;
  let phaseMessage: string | null = null;
  if (showRejoinOverlay) {
    phaseMessage = "ルームへ再参加中です...";
  } else if (roundPreparing || roundPreparingHold) {
    phaseMessage = "カードを配布しています…";
  } else if (baseOverlayMessage) {
    phaseMessage = baseOverlayMessage;
  } else if (forcedExitReason === "game-in-progress") {
    phaseMessage = "通信が一時的に不安定です。復帰待機中...";
  }

  const handNode = showHand ? (
    <MiniHandDock
      roomId={roomId}
      me={me}
      resolveMode={room.options?.resolveMode}
      proposal={proposalForUi}
      eligibleIds={eligibleIds}
      cluesReady={allCluesReady}
      isHost={isHost}
      roomStatus={room.status}
      statusVersion={room.statusVersion ?? 0}
      defaultTopicType={room.options?.defaultTopicType || "\u901a\u5e38\u7248"}
      topicBox={room.topicBox ?? null}
      allowContinueAfterFail={!!room.options?.allowContinueAfterFail}
      roomName={displayRoomName}
      currentTopic={room.topic || null}
      onlineUids={onlineUids}
      playerCount={players.length}
      roundIds={clueTargetIds}
      presenceReady={presenceReady}
      presenceDegraded={presenceDegraded}
      interactionEnabled={interactionEnabled}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onLeaveRoom={leaveRoom}
      pop={pop}
      hostClaimStatus={hostClaimStatus}
      phaseMessage={phaseMessage}
      roundPreparing={roundPreparing}
      showtimeIntentHandlers={showtimeIntentHandlers}
      updateOptimisticProposalOverride={updateOptimisticProposalOverride}
    />
  ) : undefined;

  const handAreaNode = (
    <SpectatorHUD
      controller={spectatorController}
      seatRequestTimedOut={seatRequestTimedOut}
      spectatorUpdateButton={spectatorUpdateButton}
      extraNotice={sessionNotice}
      onRetryJoin={handleRetryJoin}
      onForceExit={handleForcedExitLeaveNow}
      isSpectatorMode={isSpectatorMode}
      isMember={isMember}
      showHand={showHand}
      handNode={handNode}
      hostPanelEnabled={spectatorHostPanelEnabled}
      host={{
        enabled: isHost,
        roomId,
        requests: spectatorHostRequests,
        loading: spectatorHostLoading,
        error: spectatorHostError,
        spectatorRecallEnabled,
        canRecallSpectators,
        recallPending,
        onRecallSpectators: handleSpectatorRecall,
        players: playersWithOptimistic,
        onApprove: handleSpectatorApprove,
        onReject: handleSpectatorReject,
        autoApprove: true,
      }}
    />
  );

  const globalSafeUpdateActive =
    safeUpdateFeatureEnabled &&
    (hasWaitingUpdate || safeUpdateActive || spectatorUpdateApplying || spectatorUpdateFailed);

  const handleManualVersionUpdate = useCallback(() => {
    const applied = applyServiceWorkerUpdate({
      reason: "room:manual",
      safeMode: safeUpdateActive,
    });
    if (!applied) {
      void resyncWaitingServiceWorker("room:manual");
    }
  }, [safeUpdateActive]);
  const handleConfirmManualUpdate = useCallback(() => {
    const confirmed =
      typeof window === "undefined" ||
      window.confirm("注意: 更新するとこの部屋に戻れない可能性があります。更新を適用しますか？");
    if (!confirmed) {
      return;
    }
    handleManualVersionUpdate();
  }, [handleManualVersionUpdate]);
  const handleResyncUpdate = useCallback(() => {
    void resyncWaitingServiceWorker("room:safe-banner");
  }, []);

  const safeUpdateBannerEnabled = globalSafeUpdateActive && !shouldBlockUpdateOverlay;
  const safeUpdateErrorLabel = spectatorUpdateFailed ? safeUpdateLastError ?? "unknown" : null;
  const safeUpdateStatusLabel = (() => {
    if (spectatorUpdateApplying || safeUpdatePhase === "applying") {
      return "更新を適用しています";
    }
    if (spectatorUpdateFailed || safeUpdatePhase === "failed") {
      return "更新に失敗しました";
    }
    if (safeUpdateAutoApplySuppressed || safeUpdatePhase === "suppressed") {
      return "プレイ進行中のため更新待機中";
    }
    if (
      hasWaitingUpdate ||
      safeUpdatePhase === "auto_pending" ||
      safeUpdatePhase === "waiting_user" ||
      safeUpdatePhase === "update_detected"
    ) {
      return "背景で更新を準備しています";
    }
    return "更新を確認しています";
  })();
  const safeUpdateDetailLabel = (() => {
    if (safeUpdateErrorLabel) {
      return `原因: ${safeUpdateErrorLabel}`;
    }
    if (safeUpdateAutoApplyCountdown) {
      return safeUpdateAutoApplyCountdown;
    }
    if (safeUpdateAutoApplySuppressed || safeUpdatePhase === "suppressed") {
      return "安全なタイミングで自動適用します";
    }
    if (spectatorUpdateApplying || safeUpdatePhase === "applying") {
      return "完了すると自動で再読み込みします";
    }
    if (hasWaitingUpdate) {
      return "注意: 更新するとこの部屋に戻れない可能性があります";
    }
    return null;
  })();
  const safeUpdatePrimaryLabel = spectatorUpdateApplying
    ? "適用中..."
    : spectatorUpdateFailed
      ? "再試行"
      : "更新 (注意)";
  const safeUpdatePrimaryAction = spectatorUpdateFailed
    ? retrySpectatorUpdate
    : handleConfirmManualUpdate;
  const safeUpdateBannerNode = safeUpdateBannerEnabled ? (
    <Box
      position="fixed"
      top="12px"
      right="16px"
      zIndex={1250}
      padding="12px 16px"
      background="rgba(8, 12, 20, 0.9)"
      border="1px solid rgba(255,255,255,0.18)"
      borderRadius="6px"
      boxShadow="0 8px 18px rgba(0,0,0,0.45)"
      minW="240px"
      maxW="320px"
    >
      <VStack align="stretch" gap={2}>
        <Text fontSize="sm" fontWeight={700} color="rgba(255,255,255,0.95)">
          {safeUpdateStatusLabel}
        </Text>
        {safeUpdateDetailLabel ? (
          <Text fontSize="xs" color="rgba(255,255,255,0.7)" lineHeight={1.5}>
            {safeUpdateDetailLabel}
          </Text>
        ) : null}
        <HStack gap={2} flexWrap="wrap">
          <AppButton
            palette="brand"
            size="sm"
            onClick={safeUpdatePrimaryAction}
            disabled={spectatorUpdateApplying}
          >
            {safeUpdatePrimaryLabel}
          </AppButton>
          <AppButton
            palette="gray"
            visual="outline"
            size="sm"
            onClick={handleResyncUpdate}
            disabled={spectatorUpdateApplying}
          >
            再チェック
          </AppButton>
        </HStack>
      </VStack>
    </Box>
  ) : null;
  const joinStatusMessage =
    joinStatus === "retrying"
      ? "再接続を試行しています..."
      : joinStatus === "joining"
        ? "ルームへ再参加中です..."
        : null;

  const joinStatusBanner = joinStatusMessage ? (
    <Box
      position="fixed"
      top={safeUpdateBannerEnabled ? "64px" : "12px"}
      right="16px"
      zIndex={1200}
      padding="10px 14px"
      background="rgba(8, 12, 20, 0.82)"
      border="1px solid rgba(255,255,255,0.18)"
      color="rgba(255,255,255,0.9)"
      fontFamily="'Courier New', monospace"
      fontSize="13px"
      borderRadius="4px"
      boxShadow="0 4px 12px rgba(0,0,0,0.35)"
    >
      {joinStatusMessage}
    </Box>
  ) : null;

  const handleHardReload = useCallback(() => {
    try {
      window.location.reload();
    } catch (error) {
      logInfo("room-page", "hard-reload-failed", error);
    }
  }, []);

  const versionMismatchOverlay = shouldBlockUpdateOverlay ? (
    <Box
      position="fixed"
      inset={0}
      zIndex={1400}
      bg="rgba(4, 6, 12, 0.88)"
      backdropFilter="blur(2px)"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Box
        maxW="520px"
        w="90%"
        bg="rgba(12,16,28,0.95)"
        border="3px solid rgba(255,255,255,0.85)"
        borderRadius={0}
        boxShadow="0 12px 32px rgba(0,0,0,0.65)"
        p={{ base: 5, md: 6 }}
      >
        <VStack align="stretch" gap={4}>
          <Text
            fontSize="lg"
            fontWeight={700}
            color="white"
            textAlign="center"
            textShadow="1px 1px 0 rgba(0,0,0,0.6)"
          >
            最新バージョンへの更新が必要です
          </Text>
          <Text color="rgba(255,255,255,0.9)" fontSize="sm" lineHeight={1.7}>
            サーバーはバージョン{" "}
            <strong>{requiredSwVersion || "unknown"}</strong> を要求しています。現在のクライアント
            ({APP_VERSION}) のままではゲームを続行できないため、更新を適用してから再開してください。
          </Text>
          <HStack gap={3} flexWrap="wrap" justify="center">
            <AppButton
              palette="brand"
              size="md"
              onClick={handleManualVersionUpdate}
              disabled={spectatorUpdateApplying}
            >
              {spectatorUpdateApplying ? "適用中..." : "今すぐ更新"}
            </AppButton>
            <AppButton palette="gray" size="md" visual="outline" onClick={handleHardReload}>
              ハードリロード
            </AppButton>
          </HStack>
          <Text color="rgba(255,255,255,0.7)" fontSize="xs" textAlign="center">
            更新が進まない場合はブラウザのキャッシュをクリアしてから再読み込みしてください。
          </Text>
        </VStack>
      </Box>
    </Box>
  ) : null;

  
  if (!room) {
    return null;
  }

  return (
    <>
      <SentryRoomContext
        roomId={roomId}
        uid={uid}
        phase={phase ?? room.status ?? "waiting"}
        joinStatus={joinStatus}
        isHost={isHost}
        isMember={isMember}
        spectatorStatus={fsmSpectatorStatus ?? null}
        presenceReady={presenceReady}
        presenceDegraded={presenceDegraded}
        syncHealth={sync?.health ?? null}
      />
      <RoomView
        roomId={roomId}
        room={room}
        nodes={{
          header: headerNode,
          sidebar: sidebarNode,
          main: mainNode,
          handArea: handAreaNode,
        }}
        overlays={{
          joinStatusBanner,
          safeUpdateBannerNode,
          versionMismatchOverlay,
        }}
        dealRecoveryOpen={dealRecoveryOpen}
        onDealRecoveryDismiss={handleDealRecoveryDismiss}
        needName={needName}
        onSubmitName={handleSubmitName}
        simplePhase={{
          status: room.status || "waiting",
          canStartSorting,
          topic: room.topic || null,
        }}
        chat={{
          players: playersWithOptimistic,
          hostId: room.hostId ?? null,
          isFinished: room.status === "finished",
          onOpenLedger: handleOpenLedger,
          ledgerLabel: ledgerButtonLabel,
          canOpenLedger,
        }}
        passwordDialog={{
          isOpen: passwordDialogOpen,
          roomName: stripMinimalTag(room.name),
          isLoading: passwordDialogLoading,
          error: passwordDialogError,
          onSubmit: handleRoomPasswordSubmit,
          onCancel: handleRoomPasswordCancel,
        }}
        settings={{
          isOpen: isSettingsOpen,
          onClose: () => setIsSettingsOpen(false),
          options: room.options ?? ({} as RoomDoc["options"]),
          isHost,
          roomStatus: room.status || "waiting",
        }}
        ledger={{
          isOpen: isLedgerOpen && !!effectiveLedgerData,
          onClose: () => setIsLedgerOpen(false),
          players: effectiveLedgerData?.players ?? [],
          orderList: effectiveLedgerData?.orderList ?? [],
          topic: effectiveLedgerData?.topic ?? null,
          failed: effectiveLedgerData?.failed ?? false,
          roomId: effectiveLedgerData?.roomId ?? roomId,
          myId: effectiveLedgerData?.myId ?? meId,
          mvpVotes: effectiveLedgerData?.mvpVotes ?? null,
          stats: effectiveLedgerData?.stats ?? null,
          readOnly: usingLedgerSnapshot,
          contextLabel: ledgerContextLabel,
        }}
        me={me}
        isSpectatorMode={isSpectatorMode}
        meHasPlacedCard={meHasPlacedCard}
      />
    </>
  );
}
