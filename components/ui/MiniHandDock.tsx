"use client";
import { useHostAutoStartLock } from "@/components/hooks/useHostAutoStartLock";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { ResolveMode } from "@/lib/game/resolveMode";
import { useCardSubmission } from "@/lib/hooks/useCardSubmission";
import { useClueInput } from "@/lib/hooks/useClueInput";
import { useHostActions as useHostActionsCore } from "@/lib/hooks/useHostActions";
import type { HostClaimStatus } from "@/lib/hooks/useHostClaim";
import { useRevealGate } from "@/lib/hooks/useRevealGate";
import { useRoundTimeline } from "@/lib/hooks/useRoundTimeline";
import type { ShowtimeIntentHandlers } from "@/lib/showtime/types";
import type { PlayerDoc } from "@/lib/types";
import React from "react";
import { BottomActionDock } from "./mini-hand-dock/BottomActionDock";
import { CustomTopicDialog } from "./mini-hand-dock/CustomTopicDialog";
import { HostDockControls } from "./mini-hand-dock/HostDockControls";
import { NextGameButton } from "./mini-hand-dock/NextGameButton";
import { PhaseMessageBanner } from "./mini-hand-dock/PhaseMessageBanner";
import { QuickStartProgressIndicator } from "./mini-hand-dock/QuickStartProgressIndicator";
import { RightEdgeControls } from "./mini-hand-dock/RightEdgeControls";
import { WaitingHostStartPanel } from "./mini-hand-dock/WaitingHostStartPanel";
import { useDefaultTopicTypeOverride } from "./mini-hand-dock/useDefaultTopicTypeOverride";
import { useRevealAnimatingState } from "./mini-hand-dock/useRevealAnimatingState";
import { useSyncSpinnerWatchdog } from "./mini-hand-dock/useSyncSpinnerWatchdog";
import { SeinoButton } from "./SeinoButton";

const noopCleanup = () => {};

interface MiniHandDockProps {
  roomId: string;
  me: (PlayerDoc & { id: string }) | undefined;
  resolveMode?: ResolveMode | null;
  proposal?: (string | null)[];
  eligibleIds?: string[];
  cluesReady?: boolean;
  isHost?: boolean;
  roomStatus?: string;
  statusVersion?: number | null;
  defaultTopicType?: string;
  topicBox?: string | null;
  allowContinueAfterFail?: boolean;
  roomName?: string;
  onOpenSettings?: () => void;
  onLeaveRoom?: () => void | Promise<void>;
  pop?: boolean;
  // 在席者のみでリセットするための補助情報
  onlineUids?: string[];
  playerCount?: number;
  roundIds?: string[];
  // カスタムお題（現在値）
  currentTopic?: string | null;
  hostClaimStatus?: HostClaimStatus;
  presenceReady?: boolean;
  presenceDegraded?: boolean;
  interactionEnabled?: boolean;
  phaseMessage?: string | null;
  roundPreparing?: boolean;
  showtimeIntentHandlers?: ShowtimeIntentHandlers;
  updateOptimisticProposalOverride?: (
    playerId: string,
    state: "placed" | "removed" | null,
    targetIndex?: number | null
  ) => void;
}

export default function MiniHandDock(props: MiniHandDockProps) {
  const {
    roomId,
    me,
    resolveMode,
    proposal,
    eligibleIds,
    cluesReady,
    isHost,
    roomStatus,
    statusVersion,
    defaultTopicType = "通常版",
    allowContinueAfterFail,
    topicBox = null,
    onOpenSettings,
    onLeaveRoom,
    pop = false,
    onlineUids,
    playerCount,
    roundIds,
    currentTopic,
    hostClaimStatus,
    presenceReady = true,
    presenceDegraded = false,
    interactionEnabled = true,
    phaseMessage,
    roundPreparing = false,
    showtimeIntentHandlers,
    updateOptimisticProposalOverride,
  } = props;
  const interactionDisabled = !interactionEnabled;

  const phaseMessageBottom = React.useMemo(
    () => ({ base: "calc(16px + 60px)", md: "calc(20px + 62px)" }),
    []
  );

  const hostClaimActive =
    !isHost && !!hostClaimStatus && hostClaimStatus !== "idle";
  const hostClaimMessage = React.useMemo(() => {
    switch (hostClaimStatus) {
      case "requesting":
        return "ホスト権限を申請中...";
      case "confirming":
        return "ホスト権限の確定を待機しています...";
      case "pending":
        return "ホスト権限を準備中...";
      default:
        return "ホスト権限を準備中...";
    }
  }, [hostClaimStatus]);

  // Reveal直前の一瞬だけローカルで手札UIを隠すゲート
  const {
    hideHandUI,
    begin: beginReveal,
    end: endReveal,
  } = useRevealGate(roomStatus, roomId);

  const computedDefaultTopicType = useDefaultTopicTypeOverride(defaultTopicType);
  const isRevealAnimating = useRevealAnimatingState(roomId, roomStatus);
  const [seinoTransitionBlocked, setSeinoTransitionBlocked] = React.useState(false);
  const seinoTransitionTimerRef = React.useRef<number | null>(null);
  const seinoLastPhaseStatusRef = React.useRef<string | null>(null);
  const [inlineFeedback, setInlineFeedback] = React.useState<{
    message: string;
    tone: "info" | "success";
  } | null>(null);

  // 入力フィールド参照
  const inputRef = React.useRef<HTMLInputElement>(null);

  const {
    autoStartLocked,
    beginLock: beginAutoStartLock,
    clearLock: clearAutoStartLock,
  } = useHostAutoStartLock(roomId, roomStatus);

  const {
    showSpinner,
    spinnerText,
    emit: emitStageEvent,
    reset: resetStage,
  } = useRoundTimeline();

  React.useEffect(() => {
    resetStage();
  }, [resetStage, roomId]);

  const {
    quickStart,
    quickStartPending,
    isResetting,
    resetUiPending,
    isRestarting,
    resetGame,
    handleNextGame,
    evalSorted,
    evalSortedPending,
    customOpen,
    setCustomOpen,
    customText,
    setCustomText,
    handleSubmitCustom,
    effectiveDefaultTopicType: hostDefaultTopicType,
    presenceCanStart,
    presenceForceEligible,
    presenceWaitRemainingMs,
  } = useHostActionsCore({
    roomId,
    roomStatus,
    statusVersion,
    isHost: !!isHost,
    isRevealAnimating,
    autoStartLocked,
    beginAutoStartLock,
    clearAutoStartLock,
    // MiniHandDock は現状 sort-submit 専用
    actualResolveMode: "sort-submit",
    defaultTopicType: computedDefaultTopicType,
    roundIds,
    onlineUids,
    playerCount,
    proposal,
    currentTopic,
    presenceReady,
    presenceDegraded,
    onFeedback: setInlineFeedback,
    showtimeIntents: showtimeIntentHandlers,
    onStageEvent: emitStageEvent,
  });

  const effectiveDefaultTopicType = hostDefaultTopicType;
  const optimisticResetting =
    (resetUiPending || isResetting) && roomStatus !== "waiting";
  const effectiveRoomStatus = optimisticResetting ? "waiting" : roomStatus;

  // 以降のフェーズ分岐は optimisticResetting を反映した値を使う
  const phaseStatus = effectiveRoomStatus;

  // Prevent SeinoButton "ghost slide" on room phase transitions (next-round/start/reset):
  // Tier1/Tier2 can apply room status quickly while proposal updates lag behind for a moment.
  React.useEffect(() => {
    if (typeof window === "undefined") return noopCleanup;
    const current = typeof phaseStatus === "string" ? phaseStatus : null;
    const prev = seinoLastPhaseStatusRef.current;
    seinoLastPhaseStatusRef.current = current;
    if (!current || !prev) return noopCleanup;
    if (current === prev) return noopCleanup;

    setSeinoTransitionBlocked(true);
    if (seinoTransitionTimerRef.current !== null) {
      window.clearTimeout(seinoTransitionTimerRef.current);
      seinoTransitionTimerRef.current = null;
    }
    seinoTransitionTimerRef.current = window.setTimeout(() => {
      seinoTransitionTimerRef.current = null;
      setSeinoTransitionBlocked(false);
    }, 900);

    return () => {
      if (seinoTransitionTimerRef.current !== null) {
        window.clearTimeout(seinoTransitionTimerRef.current);
        seinoTransitionTimerRef.current = null;
      }
    };
  }, [phaseStatus]);

  const {
    text,
    setText,
    clueEditable,
    canDecide,
    hasText,
    displayHasText,
    ready,
    handleDecide,
    handleClear,
    handleInputKeyDown,
  } = useClueInput({
    roomId,
    roomStatus: effectiveRoomStatus,
    player: me ?? null,
    inputRef,
    interactionEnabled,
    onFeedback: setInlineFeedback,
  });

  const {
    isSortMode,
    placed,
    canClickProposalButton,
    actionLabel,
    allSubmitted,
    shouldShowSubmitHint,
    resetSubmitHint,
    handleSubmit,
  } = useCardSubmission({
    roomId,
    roomStatus: effectiveRoomStatus,
    resolveMode,
    player: me ?? null,
    proposal,
    eligibleIds,
    cluesReady,
    clueEditable,
    inputRef,
    onFeedback: setInlineFeedback,
    isRevealAnimating,
    updateOptimisticProposal: updateOptimisticProposalOverride,
  });

  const isCustomModeSelectable =
    topicBox === "カスタム" ||
    (!topicBox && effectiveDefaultTopicType === "カスタム");
  const shouldShowSeinoButton =
    !!isHost && isSortMode && phaseStatus === "clue" && allSubmitted;

  React.useEffect(() => {
    if (!ready) return;
    const el = inputRef.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    if (document.activeElement === el) {
      el.blur();
    }
  }, [ready]);

  React.useEffect(() => {
    if (!inlineFeedback || inlineFeedback.tone === "info") {
      return noopCleanup;
    }
    const timer = window.setTimeout(() => setInlineFeedback(null), 2000);
    return () => window.clearTimeout(timer);
  }, [inlineFeedback]);

  React.useEffect(() => {
    if (!clueEditable) {
      setInlineFeedback(null);
    }
  }, [clueEditable]);

  React.useEffect(() => {
    if (!shouldShowSubmitHint) {
      return noopCleanup;
    }
    const timer = window.setTimeout(() => {
      resetSubmitHint();
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [resetSubmitHint, shouldShowSubmitHint]);

  const baseActionTooltip =
    isSortMode && placed ? "カードを待機エリアに戻す" : "カードを場に出す";
  const preparing = !!(
    showSpinner ||
    evalSortedPending ||
    autoStartLocked ||
    quickStartPending ||
    isRestarting ||
    isResetting ||
    resetUiPending ||
    roundPreparing
  );
  const seinoVisible =
    shouldShowSeinoButton &&
    !seinoTransitionBlocked &&
    !preparing &&
    !hideHandUI &&
    !isRevealAnimating;
  const clearButtonDisabled = preparing || !clueEditable || !hasText || placed;
  const clearTooltip = preparing
    ? "準備中は操作できません"
    : !clueEditable
      ? "判定中は操作できません"
      : placed
        ? "カード提出中は操作できません"
        : !displayHasText
          ? "連想ワードが入力されていません"
          : "連想ワードをクリア";
  const decideTooltip = preparing
    ? "準備中は操作できません"
    : !clueEditable
      ? "判定中は操作できません"
      : !displayHasText
        ? "連想ワードを入力してください"
        : "連想ワードを決定";
  const submitDisabledReason = preparing
    ? "準備中は操作できません"
    : !clueEditable
      ? "このタイミングではカードを出せません"
      : !me?.id
        ? "参加処理が終わるまで待ってください"
        : typeof me?.number !== "number"
          ? "番号が配られるまで待ってください"
          : !displayHasText
            ? "連想ワードを入力するとカードを出せます"
            : !ready
              ? "「決定」を押すとカードを出せます"
              : "カードを場に出せません";
  const effectiveCanClickProposalButton = !preparing && canClickProposalButton;
  const submitTooltip = effectiveCanClickProposalButton
    ? baseActionTooltip
    : submitDisabledReason;

  const _playLedgerOpen = useSoundEffect("ledger_open"); // reserved (ledger button hidden)
  const playCardDeal = useSoundEffect("card_deal");
  const playTopicShuffle = useSoundEffect("topic_shuffle");
  const showQuickStartProgress =
    showSpinner ||
    quickStartPending ||
    autoStartLocked ||
    roundPreparing ||
    isRestarting;
  const effectiveSpinnerText = showSpinner
    ? spinnerText
    : roundPreparing
      ? "次のラウンドを準備しています…"
      : quickStartPending || isRestarting
        ? "状態を同期しています…"
        : spinnerText;
  useSyncSpinnerWatchdog({
    roomId,
    roomStatus,
    quickStartPending,
    isRestarting,
    autoStartLocked,
    roundPreparing,
    showSpinner,
    effectiveSpinnerText,
  });

  React.useEffect(() => {
    if (
      !quickStartPending &&
      !autoStartLocked &&
      !roundPreparing &&
      !isRestarting
    ) {
      resetStage();
    }
  }, [
    quickStartPending,
    autoStartLocked,
    roundPreparing,
    isRestarting,
    resetStage,
  ]);

  // preparing is defined above and includes roundPreparing/resetUiPending.
  const isGameFinished = phaseStatus === "finished";
  // 戦績ボタンは MiniHandDock 側では表示しない（MinimalChat 側に一本化）
  const showLedgerButton = false;
  const openCustomTopic = React.useCallback(() => {
    setCustomText(currentTopic || "");
    setCustomOpen(true);
  }, [currentTopic, setCustomOpen, setCustomText]);

  return (
    <>
      {/* 🔥 せーの！ボタン（フッター外の浮遊ボタン - Octopath風） */}
      <SeinoButton
        isVisible={seinoVisible}
        disabled={preparing || isRevealAnimating || interactionDisabled}
        onClick={async () => {
          try {
            const ok = await evalSorted();
            if (ok) {
              beginReveal();
            }
          } catch {
            endReveal();
          }
        }}
      />

      {/* ========================================
          🌙 カード配布中インジケータ
          ----------------------------------------
          据え置きゲーム風：シンプルにスピナー＋テキスト
          背景なし、テキストシャドウで可読性確保
          ======================================== */}
      <QuickStartProgressIndicator
        show={showQuickStartProgress}
        text={effectiveSpinnerText}
      />

      {phaseStatus === "waiting" &&
        !preparing &&
        (isHost || hostClaimActive) && (
          <WaitingHostStartPanel
            isHost={!!isHost}
            hostClaimMessage={hostClaimMessage}
            presenceCanStart={presenceCanStart}
            quickStartPending={quickStartPending}
            interactionDisabled={interactionDisabled}
            onStart={quickStart}
            presenceReady={presenceReady}
            presenceDegraded={presenceDegraded}
            presenceForceEligible={presenceForceEligible}
            presenceWaitRemainingMs={presenceWaitRemainingMs}
          />
        )}

      {/* 次のゲームボタン (フッターパネルとカードの間) */}
      {isHost &&
        ((phaseStatus === "reveal" && !!allowContinueAfterFail) ||
          phaseStatus === "finished") &&
        !autoStartLocked &&
        !isRestarting &&
        !(phaseStatus === "reveal" && isRevealAnimating) && (
          <NextGameButton
            onClick={handleNextGame}
            disabled={
              isRestarting ||
              quickStartPending ||
              autoStartLocked ||
              interactionDisabled
            }
          />
      )}

      {/* 中央下部: シームレス浮遊ボタン群（revealゲート中はDOMごと非表示） */}
      <BottomActionDock
        visible={!hideHandUI}
        interactionDisabled={interactionDisabled}
        pop={pop}
        number={me?.number || null}
        inputRef={inputRef}
        text={text}
        onTextChange={setText}
        onInputKeyDown={handleInputKeyDown}
        clueEditable={clueEditable}
        preparing={preparing}
        decideTooltip={decideTooltip}
        clearTooltip={clearTooltip}
        submitTooltip={submitTooltip}
        onDecide={handleDecide}
        onClear={handleClear}
        onSubmit={handleSubmit}
        canDecide={canDecide}
        clearButtonDisabled={clearButtonDisabled}
        canSubmit={effectiveCanClickProposalButton}
        actionLabel={actionLabel}
        hostControls={
          isHost ? (
            <HostDockControls
              roomId={roomId}
              effectiveDefaultTopicType={effectiveDefaultTopicType}
              isGameFinished={isGameFinished}
              isResetting={isResetting}
              interactionDisabled={interactionDisabled}
              onOpenCustomTopic={openCustomTopic}
              onResetGame={() => resetGame({ playSound: true })}
              playCardDeal={playCardDeal}
              playTopicShuffle={playTopicShuffle}
            />
          ) : null
        }
      />

      {/* 状況アナウンス */}
      <PhaseMessageBanner message={phaseMessage} bottom={phaseMessageBottom} />

      {/* 右端: 共通ボタン (設定・退出のみ) */}
      <RightEdgeControls
        showCustomTopicPen={
          !isHost &&
          isCustomModeSelectable &&
          (phaseStatus === "waiting" || phaseStatus === "clue")
        }
        showLedgerButton={showLedgerButton}
        interactionDisabled={interactionDisabled}
        onOpenCustomTopic={openCustomTopic}
        onOpenSettings={onOpenSettings}
        onLeaveRoom={onLeaveRoom}
      />

      {/* カスタムお題入力モーダル（簡易版） */}
      {/* このモーダルは外側クリック/ESCで閉じない（初心者が迷わないように明示ボタンのみ）*/}
      <CustomTopicDialog
        open={customOpen}
        value={customText}
        interactionDisabled={interactionDisabled}
        onChange={setCustomText}
        onClose={() => setCustomOpen(false)}
        onSubmit={handleSubmitCustom}
      />
    </>
  );
}
