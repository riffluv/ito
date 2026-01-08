"use client";

// V3: 遅延表示は不要になったため削除

// HUD は初期表示の軽量化を優先し、必要になるまで読み込まない。
// import { Hud } from "@/components/Hud";

// 中央領域はモニター・ボード・手札に絞り、それ以外の UI は周辺に配置。
// PlayBoard/TopicDisplay/PhaseTips/SortBoard removed from center to keep only monitor + board + hand
import { RoomMainNode } from "./RoomMainNode";
import { RoomSidebarNode } from "./RoomSidebarNode";
import type { RoomStateSnapshot } from "./RoomStateProvider";
import { RoomHandDockNode } from "./RoomHandDockNode";
import { RoomHandAreaNode } from "./RoomHandAreaNode";

import { RoomView } from "@/components/rooms/RoomView";
import SentryRoomContext from "@/components/telemetry/SentryRoomContext";
import { AppButton } from "@/components/ui/AppButton";
import { MultiSessionNotice } from "@/components/ui/MultiSessionNotice";
import { useTransition } from "@/components/ui/TransitionProvider";
import { useAuth } from "@/context/AuthContext";
import { PRESENCE_STALE_MS } from "@/lib/constants/presence";
import { stripMinimalTag } from "@/lib/game/displayMode";
import { collectServerAssignedSeatIds } from "@/lib/game/selectors";
import { useCluePhaseHygiene } from "@/lib/hooks/useCluePhaseHygiene";
import { useDisplayNameGate } from "@/lib/hooks/useDisplayNameGate";
import { useForcedExit } from "@/lib/hooks/useForcedExit";
import { useHostClaim } from "@/lib/hooks/useHostClaim";
import { useHostClaimCandidateId } from "@/lib/hooks/useHostClaimCandidateId";
import { useHostClaimDerivations } from "@/lib/hooks/useHostClaimDerivations";
import { useHostPruning } from "@/lib/hooks/useHostPruning";
import { useJoinEstablished } from "@/lib/hooks/useJoinEstablished";
import { useLastKnownHostId } from "@/lib/hooks/useLastKnownHostId";
import { usePlayerJoinOrderTracker } from "@/lib/hooks/usePlayerJoinOrderTracker";
import { usePopPulse } from "@/lib/hooks/usePopPulse";
import { usePresenceSessionGuard } from "@/lib/hooks/usePresenceSessionGuard";
import { useRedirectGuard } from "@/lib/hooks/useRedirectGuard";
import { useRoomBoardDerivations } from "@/lib/hooks/useRoomBoardDerivations";
import { useRoomDealPlayers } from "@/lib/hooks/useRoomDealPlayers";
import { useRoomDisplayNameHelpers } from "@/lib/hooks/useRoomDisplayNameHelpers";
import { useRoomEligibleIds } from "@/lib/hooks/useRoomEligibleIds";
import { useRoomHostActionsUi } from "@/lib/hooks/useRoomHostActionsUi";
import { useRoomHostAvailability } from "@/lib/hooks/useRoomHostAvailability";
import { useRoomLeaveFlow } from "@/lib/hooks/useRoomLeaveFlow";
import { useRoomLedgerState } from "@/lib/hooks/useRoomLedgerState";
import { useRoomMeWithOptimisticPlayers } from "@/lib/hooks/useRoomMeWithOptimisticPlayers";
import { useRoomOptimisticOrderProposal } from "@/lib/hooks/useRoomOptimisticOrderProposal";
import { useRoomOptimisticSeatHold } from "@/lib/hooks/useRoomOptimisticSeatHold";
import { useRoomPasswordGate } from "@/lib/hooks/useRoomPasswordGate";
import { useRoomPlayerHygiene } from "@/lib/hooks/useRoomPlayerHygiene";
import { useRoomPhaseMetrics } from "@/lib/hooks/useRoomPhaseMetrics";
import { useRoomRequiredSwVersionHint } from "@/lib/hooks/useRoomRequiredSwVersionHint";
import { useRoomRevealPendingCleanup } from "@/lib/hooks/useRoomRevealPendingCleanup";
import { useRoomSafeUpdateAutomation } from "@/lib/hooks/useRoomSafeUpdateAutomation";
import { useRoomSelfOnlineMetric } from "@/lib/hooks/useRoomSelfOnlineMetric";
import { useRoomShowtimeFlow } from "@/lib/hooks/useRoomShowtimeFlow";
import { useRoomUpdateOverlays } from "@/lib/hooks/useRoomUpdateOverlays";
import { useRoundPreparingHold } from "@/lib/hooks/useRoundPreparingHold";
import { useServiceWorkerUpdate } from "@/lib/hooks/useServiceWorkerUpdate";
import { useSpectatorAutoEnterLeave } from "@/lib/hooks/useSpectatorAutoEnterLeave";
import { useSpectatorGate } from "@/lib/hooks/useSpectatorGate";
import { useSpectatorHostModerationHandlers } from "@/lib/hooks/useSpectatorHostModerationHandlers";
import { useSpectatorJoinStatus } from "@/lib/hooks/useSpectatorJoinStatus";
import { useSpectatorStateLogging } from "@/lib/hooks/useSpectatorStateLogging";
import { useSpectatorHostQueue } from "@/lib/spectator/v2/useSpectatorHostQueue";
import { useSpectatorSession } from "@/lib/spectator/v2/useSpectatorSession";
import { useRoomSpectatorFlow } from "@/lib/spectator/v2/useRoomSpectatorFlow";
import type { RoomMachineClientEvent } from "@/lib/state/roomMachine";
import type { RoomDoc } from "@/lib/types";
import { traceAction } from "@/lib/utils/trace";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

const SAFE_UPDATE_FORCE_APPLY_DELAY_MS = 2 * 60 * 1000;
const ROUND_PREPARING_HOLD_MS = 1200;
const HOST_UNAVAILABLE_GRACE_MS = Math.max(
  10_000,
  Math.min(PRESENCE_STALE_MS, 30_000)
);

const SPECTATOR_HOST_PANEL_ENABLED = false;

type AuthContextValue = ReturnType<typeof useAuth>;

function getPhaseMessage(params: {
  showRejoinOverlay: boolean;
  roundPreparing: boolean;
  roundPreparingHold: boolean;
  baseOverlayMessage: string | null;
  forcedExitReason: string | null;
}): string | null {
  const {
    showRejoinOverlay,
    roundPreparing,
    roundPreparingHold,
    baseOverlayMessage,
    forcedExitReason,
  } = params;

  if (showRejoinOverlay) {
    return "ルームへ再参加中です...";
  }
  if (roundPreparing || roundPreparingHold) {
    return "カードを配布しています…";
  }
  if (baseOverlayMessage) {
    return baseOverlayMessage;
  }
  if (forcedExitReason === "game-in-progress") {
    return "通信が一時的に不安定です。復帰待機中...";
  }
  return null;
}

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
  const dealPlayers = useRoomDealPlayers(room?.deal?.players);
  const requiredSwVersion = useRoomRequiredSwVersionHint(room?.requiredSwVersion);
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
  useRoomPhaseMetrics({ roomStatus, isHost });
  const shouldBlockUpdateOverlay = false;
  const orderList = room?.order?.list;
  const roomDealPlayers = room?.deal?.players;
  const orderProposal = room?.order?.proposal;
  const roundPreparing = room?.ui?.roundPreparing === true;
  const roundPreparingHold = useRoundPreparingHold(roundPreparing, ROUND_PREPARING_HOLD_MS);
  const {
    isLedgerOpen,
    usingLedgerSnapshot,
    effectiveLedgerData,
    canOpenLedger,
    ledgerButtonLabel,
    ledgerContextLabel,
    handleOpenLedger,
    handleCloseLedger,
  } = useRoomLedgerState({
    roomId,
    room,
    players: playersWithOptimistic,
    myId: meId,
  });

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

  const { proposalForUi, updateOptimisticProposalOverride } =
    useRoomOptimisticOrderProposal({
      orderProposal,
      roomStatus: room?.status ?? null,
    });

  const { slotCount, submittedPlayerIds, canStartSorting, meHasPlacedCard, baseOverlayMessage } =
    useRoomBoardDerivations({
      room,
      orderList,
      roomDealPlayers,
      orderProposal,
      players,
      playersWithOptimistic,
      eligibleIds,
      presenceReady,
      onlineUids,
      meId,
      isMember,
    });
  const displayRoomName = stripMinimalTag(room?.name) || "";

  // Layout nodes split to avoid JSX nesting pitfalls
  const headerNode = undefined;

  const sidebarNode = (
    <RoomSidebarNode
      players={playersWithOptimistic}
      roomStatus={room?.status || "waiting"}
      onlineCount={onlinePlayers.length}
      onlineUids={onlineUids}
      hostId={room?.hostId ?? null}
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
    <RoomMainNode
      roomId={roomId}
      room={room}
      players={playersWithOptimistic}
      meId={boardMeId}
      eligibleIds={eligibleIds}
      cluesReady={allCluesReady}
      proposal={proposalForUi}
      slotCount={slotCount}
      dealPlayers={dealPlayers}
      currentStreak={room.stats?.currentStreak ?? 0}
      onOptimisticProposalChange={updateOptimisticProposalOverride}
      sendRoomEvent={sendRoomEvent}
      presenceReady={presenceReady}
      interactionEnabled={interactionEnabled}
    />
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

  const { handleSpectatorApprove, handleSpectatorReject } = useSpectatorHostModerationHandlers({
    roomId,
    approveSpectatorRejoin,
    rejectSpectatorRejoin,
    resolveSpectatorDisplayName,
  });

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
  const phaseMessage = getPhaseMessage({
    showRejoinOverlay,
    roundPreparing,
    roundPreparingHold,
    baseOverlayMessage,
    forcedExitReason,
  });

  const handNode = showHand ? (
    <RoomHandDockNode
      roomId={roomId}
      room={room}
      me={me}
      proposal={proposalForUi}
      eligibleIds={eligibleIds}
      cluesReady={allCluesReady}
      isHost={isHost}
      displayRoomName={displayRoomName}
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
    <RoomHandAreaNode
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
  const { safeUpdateBannerNode, joinStatusBanner, versionMismatchOverlay } = useRoomUpdateOverlays({
    safeUpdateFeatureEnabled,
    hasWaitingUpdate,
    safeUpdateActive,
    spectatorUpdateApplying,
    spectatorUpdateFailed,
    shouldBlockUpdateOverlay,
    safeUpdatePhase,
    safeUpdateLastError,
    safeUpdateAutoApplySuppressed,
    safeUpdateAutoApplyCountdown,
    retrySpectatorUpdate,
    joinStatus,
    requiredSwVersion,
  });

  
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
          onClose: handleCloseLedger,
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
