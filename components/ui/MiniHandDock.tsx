"use client";
import { useHostAutoStartLock } from "@/components/hooks/useHostAutoStartLock";
import { AppButton } from "@/components/ui/AppButton";
import OctopathDockButton from "@/components/ui/OctopathDockButton";
import Tooltip from "@/components/ui/Tooltip";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { ResolveMode } from "@/lib/game/resolveMode";
import { topicControls } from "@/lib/game/service";
import { useCardSubmission } from "@/lib/hooks/useCardSubmission";
import { useClueInput } from "@/lib/hooks/useClueInput";
import { useHostActions as useHostActionsCore } from "@/lib/hooks/useHostActions";
import type { HostClaimStatus } from "@/lib/hooks/useHostClaim";
import { useRevealGate } from "@/lib/hooks/useRevealGate";
import { useRoundTimeline } from "@/lib/hooks/useRoundTimeline";
import type { ShowtimeIntentHandlers } from "@/lib/showtime/types";
import { isTopicType, type TopicType } from "@/lib/topics";
import type { PlayerDoc } from "@/lib/types";
import { setMetric, readMetrics } from "@/lib/utils/metrics";
import { traceAction } from "@/lib/utils/trace";
import { notify } from "@/components/ui/notify";
import { toastIds } from "@/lib/ui/toastIds";
import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { UI_TOKENS } from "@/theme/layout";
import {
  Box,
  Dialog,
  Flex,
  HStack,
  IconButton,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import Image from "next/image";
import React from "react";
import { FiEdit2, FiLogOut, FiSettings } from "react-icons/fi";
import { DiamondNumberCard } from "./DiamondNumberCard";
import { HD2DLoadingSpinner } from "./HD2DLoadingSpinner";
import { KEYBOARD_KEYS } from "./hints/constants";
import {
  FOOTER_BUTTON_BASE_STYLES,
  orangeGlowNext,
  orangeGlowStart,
  phaseMessagePulse,
  subtleTextPulse,
} from "./miniHandDockStyles";
import { SeinoButton } from "./SeinoButton";
import { SEINO_BUTTON_STYLES } from "./seinoButtonStyles";

type HostPanelIconProps = {
  src: string;
  alt: string;
};

const HostPanelIcon = ({ src, alt }: HostPanelIconProps) => (
  <Image
    src={src}
    alt={alt}
    width={64}
    height={64}
    sizes="20px"
    style={{ width: "100%", height: "100%", objectFit: "contain" }}
    priority={false}
  />
);
const noopCleanup = () => {};
type RevealAnimatingEvent = CustomEvent<{
  roomId?: string;
  animating?: boolean;
}>;
type DefaultTopicTypeChangeEvent = CustomEvent<{ defaultTopicType?: string }>;

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

  // defaultTopicType の即時反映: Firestore反映遅延やローカル保存に追従
  const [defaultTopicOverride, setDefaultTopicOverride] = React.useState<
    string | undefined
  >(defaultTopicType);
  React.useEffect(
    () => setDefaultTopicOverride(defaultTopicType),
    [defaultTopicType]
  );
  React.useEffect(() => {
    if (typeof window === "undefined") {
      return noopCleanup;
    }
    const handleDefaultTopicChange: EventListener = (event) => {
      const detail = (event as DefaultTopicTypeChangeEvent).detail;
      const nextType = detail?.defaultTopicType;
      if (typeof nextType === "string") {
        setDefaultTopicOverride(nextType);
      }
    };
    window.addEventListener(
      "defaultTopicTypeChanged",
      handleDefaultTopicChange
    );
    try {
      const stored = window.localStorage.getItem("defaultTopicType");
      if (stored) setDefaultTopicOverride(stored);
    } catch {
      // ignore storage failure
    }
    return () => {
      window.removeEventListener(
        "defaultTopicTypeChanged",
        handleDefaultTopicChange
      );
    };
  }, []);

  const computedDefaultTopicType =
    defaultTopicOverride ?? defaultTopicType ?? "通常版";

  const [isRevealAnimating, setIsRevealAnimating] = React.useState(
    roomStatus === "reveal"
  );
  const [seinoTransitionBlocked, setSeinoTransitionBlocked] = React.useState(false);
  const seinoTransitionTimerRef = React.useRef<number | null>(null);
  const seinoLastPhaseStatusRef = React.useRef<string | null>(null);
  const [inlineFeedback, setInlineFeedback] = React.useState<{
    message: string;
    tone: "info" | "success";
  } | null>(null);
  const [topicActionLoading, setTopicActionLoading] = React.useState(false);
  const [dealActionLoading, setDealActionLoading] = React.useState(false);

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
  React.useEffect(() => {
    if (typeof window === "undefined") {
      return noopCleanup;
    }
    const handleRevealAnimating: EventListener = (event) => {
      const detail = (event as RevealAnimatingEvent).detail;
      if (!detail) return;
      if (detail.roomId && detail.roomId !== roomId) return;
      setIsRevealAnimating(Boolean(detail.animating));
    };
    window.addEventListener("ito:reveal-animating", handleRevealAnimating);
    return () => {
      window.removeEventListener("ito:reveal-animating", handleRevealAnimating);
    };
  }, [roomId]);

  React.useEffect(() => {
    if (roomStatus === "reveal") {
      setIsRevealAnimating(true);
    } else {
      setIsRevealAnimating(false);
    }
  }, [roomStatus]);

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

  const syncSpinnerWatchdogRef = React.useRef<number | null>(null);
  const syncSpinnerLoggedRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return noopCleanup;
    }
    const syncPending = quickStartPending || isRestarting;
    if (!syncPending || roomStatus === "clue") {
      syncSpinnerLoggedRef.current = false;
      if (syncSpinnerWatchdogRef.current !== null) {
        window.clearTimeout(syncSpinnerWatchdogRef.current);
        syncSpinnerWatchdogRef.current = null;
      }
      return noopCleanup;
    }

    if (syncSpinnerLoggedRef.current || syncSpinnerWatchdogRef.current !== null) {
      return noopCleanup;
    }

    syncSpinnerWatchdogRef.current = window.setTimeout(() => {
      syncSpinnerWatchdogRef.current = null;
      if (syncSpinnerLoggedRef.current) return;
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const metrics = readMetrics();
      const lastSnapshotTsRaw = (metrics as { roomSnapshot?: { lastSnapshotTs?: unknown } })
        .roomSnapshot?.lastSnapshotTs;
      const lastSnapshotTs =
        typeof lastSnapshotTsRaw === "number" && Number.isFinite(lastSnapshotTsRaw)
          ? lastSnapshotTsRaw
          : null;
      const snapshotAgeMs =
        typeof lastSnapshotTs === "number" ? Math.max(0, now - lastSnapshotTs) : null;

      setMetric("hostAction", "syncSpinner.stuckAt", now);
      setMetric("hostAction", "syncSpinner.roomStatus", roomStatus ?? "unknown");
      setMetric(
        "hostAction",
        "syncSpinner.reason",
        quickStartPending ? "quickStartPending" : isRestarting ? "isRestarting" : "unknown"
      );
      if (snapshotAgeMs !== null) {
        setMetric("hostAction", "syncSpinner.snapshotAgeMs", Math.round(snapshotAgeMs));
      }

      traceAction("ui.syncSpinner.stuck", {
        roomId,
        roomStatus: roomStatus ?? "unknown",
        quickStartPending: quickStartPending ? "1" : "0",
        isRestarting: isRestarting ? "1" : "0",
        autoStartLocked: autoStartLocked ? "1" : "0",
        roundPreparing: roundPreparing ? "1" : "0",
        showSpinner: showSpinner ? "1" : "0",
        spinnerText: effectiveSpinnerText,
        visibility: document.visibilityState,
        online: typeof navigator !== "undefined" ? (navigator.onLine ? "1" : "0") : "unknown",
        snapshotAgeMs: snapshotAgeMs === null ? undefined : String(Math.round(snapshotAgeMs)),
      });

      try {
        window.dispatchEvent(
          new CustomEvent("ito:room-force-refresh", {
            detail: { roomId, reason: "ui.syncSpinner.stuck" },
          })
        );
      } catch {}
      try {
        window.dispatchEvent(
          new CustomEvent("ito:room-restart-listener", {
            detail: { roomId, reason: "ui.syncSpinner.stuck" },
          })
        );
      } catch {}

      notify({
        id: toastIds.genericInfo(roomId, "sync-spinner-stuck"),
        title: "状態の同期が遅れています",
        description: "最新の状態を取得します。改善しない場合はページを再読み込みしてください。",
        type: "warning",
        duration: 4200,
      });

      syncSpinnerLoggedRef.current = true;
    }, 5000);

    return () => {
      if (syncSpinnerWatchdogRef.current !== null) {
        window.clearTimeout(syncSpinnerWatchdogRef.current);
        syncSpinnerWatchdogRef.current = null;
      }
    };
  }, [
    autoStartLocked,
    effectiveSpinnerText,
    isRestarting,
    quickStartPending,
    roomId,
    roomStatus,
    roundPreparing,
    showSpinner,
  ]);

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
      {showQuickStartProgress && (
        <Box
          position="fixed"
          bottom={{
            base: "clamp(120px, 18vh, 220px)",
            md: "clamp(130px, 16vh, 240px)",
          }}
          left="50%"
          transform="translateX(-50%)"
          zIndex={56}
          pointerEvents="none"
          // レイアウト: スピナーとテキストを縦に配置
          display="flex"
          flexDirection="column"
          alignItems="center"
          gap="10px"
        >
          {/* 🌕 満月スピナー */}
          <HD2DLoadingSpinner size={scaleForDpi("38px")} />

          {/* 📜 テキスト: 儀式感のある黄金テキスト */}
          <Text
            // v2準拠: 黄金寄りの色
            fontSize="0.85rem"
            fontWeight="600"
            color="rgba(255, 248, 225, 0.92)"
            letterSpacing="0.06em"
            fontFamily="monospace"
            // 強めのシャドウ＋わずかなグローで可読性確保
            textShadow={`
              0 1px 3px rgba(0, 0, 0, 0.9),
              0 2px 6px rgba(0, 0, 0, 0.7),
              0 0 12px rgba(255, 240, 200, 0.12)
            `}
            // 微妙な上下アニメーション（息づき）
            css={{
              animation:
                "subtleFloat 2.8s cubic-bezier(.4,.15,.6,.85) infinite",
              "@keyframes subtleFloat": {
                "0%, 100%": { transform: "translateY(0)" },
                "50%": { transform: "translateY(-1.5px)" },
              },
            }}
          >
            {effectiveSpinnerText}
          </Text>
        </Box>
      )}

      {phaseStatus === "waiting" &&
        !preparing &&
        (isHost || hostClaimActive) && (
          <Box
            position="fixed"
            bottom={{
              base: `clamp(${scaleForDpi("120px")}, 18vh, ${scaleForDpi("220px")})`,
              md: `clamp(${scaleForDpi("130px")}, 16vh, ${scaleForDpi("240px")})`,
            }}
            left="50%"
            transform="translateX(-50%)"
            zIndex={55}
          >
            {isHost ? (
              <AppButton
                {...SEINO_BUTTON_STYLES}
                size="lg"
                visual="solid"
                onClick={() => quickStart()}
                disabled={!presenceCanStart || quickStartPending || interactionDisabled}
                css={{
                  animation: `${orangeGlowStart} 3.2s cubic-bezier(.42,.15,.58,.85) infinite`,
                }}
              >
                ゲーム開始
              </AppButton>
            ) : (
              <Text
                fontSize="sm"
                fontWeight="bold"
                color="rgba(255,255,255,0.95)"
                textAlign="left"
                animation={`${subtleTextPulse} 1.6s ease-in-out infinite`}
              >
                {hostClaimMessage}
              </Text>
            )}
            {isHost && !presenceReady && !presenceDegraded && !presenceForceEligible ? (
              <Text
                mt={2}
                fontSize="xs"
                fontWeight="bold"
                color="rgba(255,255,255,0.75)"
                textAlign="center"
              >
                参加者の接続を待っています…（あと{Math.ceil(presenceWaitRemainingMs / 1000)}秒）
              </Text>
            ) : null}
            {isHost && !presenceReady && (presenceDegraded || presenceForceEligible) ? (
              <Text
                mt={2}
                fontSize="xs"
                fontWeight="bold"
                color="rgba(255,255,255,0.75)"
                textAlign="center"
              >
                接続未確認ですが開始できます
              </Text>
            ) : null}
          </Box>
        )}

      {/* 次のゲームボタン (フッターパネルとカードの間) */}
      {isHost &&
        ((phaseStatus === "reveal" && !!allowContinueAfterFail) ||
          phaseStatus === "finished") &&
        !autoStartLocked &&
        !isRestarting &&
        !(phaseStatus === "reveal" && isRevealAnimating) && (
          <Box
            position="fixed"
            bottom={{
              base: `clamp(${scaleForDpi("120px")}, 18vh, ${scaleForDpi("220px")})`,
              md: `clamp(${scaleForDpi("130px")}, 16vh, ${scaleForDpi("240px")})`,
            }}
            left="50%"
            transform="translateX(-50%)"
            zIndex={55}
          >
            <AppButton
              {...SEINO_BUTTON_STYLES}
              size="lg"
              visual="solid"
              muteClickSound
              onClick={handleNextGame}
              disabled={
                isRestarting || quickStartPending || autoStartLocked || interactionDisabled
              }
              css={{
                animation: `${orangeGlowNext} 3.8s cubic-bezier(.38,.18,.62,.82) infinite`,
              }}
            >
              次のゲーム
            </AppButton>
          </Box>
        )}

      {/* 中央下部: シームレス浮遊ボタン群（revealゲート中はDOMごと非表示） */}
      {!hideHandUI && (
        <Flex
          position="fixed"
          bottom={{ base: scaleForDpi("20px"), md: scaleForDpi("24px") }}
          left="50%"
          transform="translateX(-50%)"
          zIndex={50}
          data-guide-target="mini-hand-dock"
          gap={{ base: scaleForDpi("10px"), md: scaleForDpi("14px") }}
          align="center"
          justify="center"
          flexWrap="nowrap"
          maxW="95vw"
          pointerEvents={interactionDisabled ? "none" : "auto"}
        >
          {/* 数字カード（大きく・モダン） */}
          <Box
            flexShrink={0}
            transform={{ base: "scale(1.1)", md: "scale(1.2)" }}
            transformOrigin="left center"
            mr={{ base: scaleForDpi("14px"), md: scaleForDpi("20px") }}
          >
            {/* revealゲート中は上位の条件でDOM未描画 */}
            <DiamondNumberCard number={me?.number || null} isAnimating={pop} />
          </Box>

          {/* 入力エリア（常時表示・シームレス） */}
          <HStack
            gap={{ base: scaleForDpi("8px"), md: scaleForDpi("10px") }}
            flexWrap="nowrap"
          >
            <Input
              ref={inputRef}
              aria-label="連想ワード"
              placeholder="連想ワード..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleInputKeyDown}
              data-guide-target="association-input"
              maxLength={50}
              size="md"
              bg="rgba(18,22,32,0.85)"
              color="rgba(255,255,255,0.98)"
              fontFamily="'Courier New', monospace"
              fontSize={{ base: scaleForDpi("14px"), md: scaleForDpi("16px") }}
              fontWeight="700"
              letterSpacing="0.02em"
              border="none"
              borderRadius={scaleForDpi("3px")}
              boxShadow={`inset ${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(0,0,0,0.5), 0 0 0 ${scaleForDpi("1px")} rgba(255,255,255,0.25)`}
              h={scaleForDpi("40px")}
              minH={scaleForDpi("40px")}
              w={{ base: scaleForDpi("200px"), md: scaleForDpi("280px") }}
              transition="box-shadow 150ms ease"
              disabled={!clueEditable || preparing}
              _placeholder={{
                color: "rgba(255,255,255,0.35)",
              }}
              _focus={{
                boxShadow:
                  `inset ${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(0,0,0,0.5), 0 0 0 ${scaleForDpi("1px")} rgba(255,255,255,0.4)`,
                bg: "rgba(22,26,36,0.9)",
                outline: "none",
              }}
              _disabled={{
                opacity: 0.5,
                cursor: "not-allowed",
              }}
            />
            <Tooltip content={decideTooltip} showArrow openDelay={180}>
              <AppButton
                {...FOOTER_BUTTON_BASE_STYLES}
                size="sm"
                visual="solid"
                palette="brand"
                onClick={handleDecide}
                disabled={preparing || !canDecide || interactionDisabled}
                w="auto"
                minW={scaleForDpi("60px")}
              >
                決定
              </AppButton>
            </Tooltip>
            <Tooltip content={clearTooltip} showArrow openDelay={180}>
              <AppButton
                {...FOOTER_BUTTON_BASE_STYLES}
                size="sm"
                visual="outline"
                palette="gray"
                onClick={handleClear}
                disabled={clearButtonDisabled || interactionDisabled}
                w="auto"
                minW={scaleForDpi("60px")}
              >
                クリア
              </AppButton>
            </Tooltip>
            <Tooltip content={submitTooltip} showArrow openDelay={180}>
              <AppButton
                {...FOOTER_BUTTON_BASE_STYLES}
                size="sm"
                visual="solid"
                palette="brand"
                onClick={handleSubmit}
                disabled={!effectiveCanClickProposalButton || interactionDisabled}
                w="auto"
                minW={scaleForDpi("70px")}
              >
                {actionLabel}
              </AppButton>
            </Tooltip>
          </HStack>

          {/* ホスト専用ボタン */}
          {isHost ? (
            <>
              <Tooltip
                content={
                  effectiveDefaultTopicType === "カスタム"
                    ? "カスタムお題を設定"
                    : "お題をシャッフル"
                }
                showArrow
                openDelay={220}
              >
                <OctopathDockButton
                  compact
                  iconBoxSize={26}
                  icon={
                    effectiveDefaultTopicType === "カスタム" ? (
                      <FiEdit2 />
                    ) : (
                      <HostPanelIcon
                        src="/images/ui/shuffle.webp"
                        alt="Shuffle topic"
                      />
                    )
                  }
                  isLoading={topicActionLoading}
                  disabled={
                    topicActionLoading ||
                    (isGameFinished && effectiveDefaultTopicType !== "カスタム") ||
                    interactionDisabled
                  }
                  onClick={async () => {
                    if (topicActionLoading) return;
                    const mode: string | null = effectiveDefaultTopicType;

                    if (mode === "カスタム") {
                      setCustomText(currentTopic || "");
                      setCustomOpen(true);
                      return;
                    }

                    if (isGameFinished) return;
                    setTopicActionLoading(true);
                    try {
                      playTopicShuffle();
                      const topicMode: TopicType = isTopicType(mode)
                        ? mode
                        : "通常版";
                      await topicControls.shuffleTopic(roomId, topicMode);
                    } finally {
                      setTopicActionLoading(false);
                    }
                  }}
                />
              </Tooltip>

              <Tooltip content="数字を配り直す" showArrow openDelay={220}>
                <OctopathDockButton
                  compact
                  iconBoxSize={26}
                  icon={
                    <HostPanelIcon
                      src="/images/ui/deal.webp"
                      alt="Deal numbers"
                    />
                  }
                  isLoading={dealActionLoading}
                  disabled={dealActionLoading || isGameFinished || interactionDisabled}
                  onClick={async () => {
                    if (dealActionLoading || isGameFinished) return;
                    setDealActionLoading(true);
                    try {
                      playCardDeal();
                      await topicControls.dealNumbers(roomId);
                    } finally {
                      setDealActionLoading(false);
                    }
                  }}
                />
              </Tooltip>

              <Tooltip content="ゲームをリセット" showArrow openDelay={220}>
                <OctopathDockButton
                  compact
                  iconBoxSize={26}
                  icon={
                    <HostPanelIcon
                      src="/images/ui/reset.webp"
                      alt="Reset game"
                    />
                  }
                  isLoading={isResetting}
                  disabled={isResetting || interactionDisabled}
                  onClick={async () => {
                    if (isResetting) return;
                    await resetGame({ playSound: true });
                  }}
                />
              </Tooltip>
            </>
          ) : null}
        </Flex>
      )}

      {/* 状況アナウンス */}
      {phaseMessage && (
        <Box
          position="fixed"
          bottom={phaseMessageBottom}
          left="50%"
          transform="translateX(-50%)"
          zIndex={55}
          pointerEvents="none"
        >
          <Text
            display="inline-block"
            fontSize="0.85rem"
            fontWeight="bold"
            color="rgba(255,255,255,0.95)"
            letterSpacing="0.04em"
            textAlign="center"
            textShadow="0 1px 3px rgba(0,0,0,0.55)"
            whiteSpace="nowrap"
            animation={`${phaseMessagePulse} 1.7s ease-in-out infinite`}
          >
            {phaseMessage}
          </Text>
        </Box>
      )}

      {/* 右端: 共通ボタン (設定・退出のみ) */}
      <Box
        position="fixed"
        bottom={{ base: scaleForDpi("16px"), md: scaleForDpi("20px") }}
        right={{ base: scaleForDpi("32px"), md: scaleForDpi("32px") }}
        zIndex={50}
      >
        <HStack gap={scaleForDpi("10px")} align="center">
          {/* 非ホストでもカスタムモード時は"ペン"を表示（待機/連想フェーズのみ） */}
          {!isHost &&
            isCustomModeSelectable &&
            (phaseStatus === "waiting" || phaseStatus === "clue") && (
              <Tooltip content="カスタムお題を設定" showArrow openDelay={300}>
                <IconButton
                  aria-label="カスタムお題"
                  onClick={() => {
                    setCustomText(currentTopic || "");
                    setCustomOpen(true);
                  }}
                  disabled={interactionDisabled}
                  size="sm"
                  w={scaleForDpi("40px")}
                  h={scaleForDpi("40px")}
                  bg="rgba(28,32,42,0.95)"
                  color="rgba(255,255,255,0.92)"
                  borderWidth="0"
                  borderRadius="0"
                  fontFamily="'Courier New', monospace"
                  fontSize={scaleForDpi("16px")}
                  boxShadow={`${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(0,0,0,.65), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.88)`}
                  _hover={{
                    bg: "rgba(38,42,52,0.98)",
                    color: "rgba(255,255,255,1)",
                    transform: `translate(0, ${scaleForDpi("-1px")})`,
                    boxShadow:
                      `${scaleForDpi("3px")} ${scaleForDpi("3px")} 0 rgba(0,0,0,.7), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.95)`,
                  }}
                  _active={{
                    transform: `translate(${scaleForDpi("1px")}, ${scaleForDpi("1px")})`,
                    boxShadow:
                      `${scaleForDpi("1px")} ${scaleForDpi("1px")} 0 rgba(0,0,0,.75), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.82)`,
                  }}
                  transition="176ms cubic-bezier(.2,1,.3,1)"
                >
                  <FiEdit2 />
                </IconButton>
              </Tooltip>
            )}
          {showLedgerButton && null}
          {onOpenSettings && (
            <Tooltip content="設定を開く" showArrow openDelay={180}>
              <IconButton
                aria-label="設定"
                onClick={onOpenSettings}
                size="xs"
                w={scaleForDpi("36px")}
                h={scaleForDpi("36px")}
                bg="rgba(28,32,42,0.95)"
                color="rgba(255,255,255,0.92)"
                borderWidth="0"
                borderRadius="0"
                fontFamily="'Courier New', monospace"
                fontSize={scaleForDpi("15px")}
                boxShadow={`${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(0,0,0,.65), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.88)`}
                _hover={{
                  bg: "rgba(38,42,52,0.98)",
                  color: "rgba(255,255,255,1)",
                  transform: `translate(0, ${scaleForDpi("-1px")})`,
                  boxShadow:
                    `${scaleForDpi("3px")} ${scaleForDpi("3px")} 0 rgba(0,0,0,.7), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.95)`,
                }}
                _active={{
                  transform: `translate(${scaleForDpi("1px")}, ${scaleForDpi("1px")})`,
                  boxShadow:
                    `${scaleForDpi("1px")} ${scaleForDpi("1px")} 0 rgba(0,0,0,.75), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.82)`,
                }}
                transition="175ms cubic-bezier(.2,1,.3,1)"
              >
                <FiSettings />
              </IconButton>
            </Tooltip>
          )}
          {onLeaveRoom && (
            <Tooltip content="ロビーに戻る" showArrow openDelay={180}>
              <IconButton
                aria-label="退出"
                onClick={onLeaveRoom}
                size="xs"
                w={scaleForDpi("36px")}
                h={scaleForDpi("36px")}
                bg="rgba(28,32,42,0.95)"
                color="rgba(255,255,255,0.92)"
                borderWidth="0"
                borderRadius="0"
                fontFamily="'Courier New', monospace"
                fontSize={scaleForDpi("15px")}
                boxShadow={`${scaleForDpi("2px")} ${scaleForDpi("2px")} 0 rgba(0,0,0,.65), 0 0 0 ${scaleForDpi("2px")} rgba(255,255,255,0.88)`}
                _hover={{
                  bg: "rgba(52,28,28,0.98)",
                  color: "rgba(255,220,220,1)",
                  transform: `translate(0, ${scaleForDpi("-1px")})`,
                  boxShadow:
                    `${scaleForDpi("3px")} ${scaleForDpi("3px")} 0 rgba(0,0,0,.7), 0 0 0 ${scaleForDpi("2px")} rgba(255,180,180,0.95)`,
                }}
                _active={{
                  transform: `translate(${scaleForDpi("1px")}, ${scaleForDpi("1px")})`,
                  boxShadow:
                    `${scaleForDpi("1px")} ${scaleForDpi("1px")} 0 rgba(0,0,0,.75), 0 0 0 ${scaleForDpi("2px")} rgba(255,180,180,0.82)`,
                }}
                transition="173ms cubic-bezier(.2,1,.3,1)"
              >
                <FiLogOut />
              </IconButton>
            </Tooltip>
          )}
        </HStack>
      </Box>

      {/* カスタムお題入力モーダル（簡易版） */}
      {/* このモーダルは外側クリック/ESCで閉じない（初心者が迷わないように明示ボタンのみ）*/}
      <Dialog.Root
        open={customOpen}
        onOpenChange={() => {
          /* no-op */
        }}
      >
        <Dialog.Backdrop />
        <Dialog.Positioner
          position="fixed"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          zIndex={9999}
        >
          <Dialog.Content
            css={{
              background: UI_TOKENS.COLORS.panelBg,
              border: `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
              borderRadius: 0,
              boxShadow: UI_TOKENS.SHADOWS.panelDistinct,
              maxWidth: "480px",
              width: "90vw",
            }}
          >
            <Box
              p={5}
              css={{
                borderBottom: `2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`,
              }}
            >
              <Dialog.Title>
                <Text
                  fontSize="lg"
                  fontWeight="bold"
                  color="white"
                  fontFamily="monospace"
                >
                  お題を入力
                </Text>
              </Dialog.Title>
            </Box>
            <Dialog.Body p={6}>
              <VStack align="stretch" gap={4}>
                <Input
                  placeholder="れい：この夏さいだいのなぞ"
                  value={customText}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setCustomText(event.target.value)
                  }
                  onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === KEYBOARD_KEYS.ENTER) {
                      event.preventDefault();
                      if (customText.trim()) handleSubmitCustom(customText);
                    }
                  }}
                  css={{
                    height: "48px",
                    background: "white",
                    border: "borders.retrogameInput",
                    borderRadius: 0,
                    fontSize: "1rem",
                    padding: "0 16px",
                    color: "black",
                    fontWeight: "normal",
                    fontFamily: "monospace",
                    transition: "none",
                    _placeholder: {
                      color: "#666",
                      fontFamily: "monospace",
                    },
                    _focus: {
                      borderColor: "black",
                      boxShadow: UI_TOKENS.SHADOWS.panelSubtle,
                      background: "#f8f8f8",
                      outline: "none",
                    },
                    _hover: {
                      background: "#f8f8f8",
                    },
                  }}
                />
                <HStack justify="space-between" gap={3}>
                  <button
                    onClick={() => setCustomOpen(false)}
                    style={{
                      minWidth: "120px",
                      height: "40px",
                      borderRadius: 0,
                      fontWeight: "bold",
                      fontSize: "1rem",
                      fontFamily: "monospace",
                      border: "borders.retrogameThin",
                      background: "transparent",
                      color: "white",
                      cursor: "pointer",
                      textShadow: "1px 1px 0px #000",
                      transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.color =
                        "var(--colors-richBlack-800)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "white";
                    }}
                  >
                    やめる
                  </button>
                  <button
                    onClick={() => {
                      if (interactionDisabled) return;
                      if (customText.trim()) handleSubmitCustom(customText);
                    }}
                    disabled={!customText.trim() || interactionDisabled}
                    style={{
                      minWidth: "140px",
                      height: "40px",
                      borderRadius: 0,
                      fontWeight: "bold",
                      fontSize: "1rem",
                      fontFamily: "monospace",
                      border: "borders.retrogameThin",
                      background:
                        !customText.trim() || interactionDisabled
                          ? "#666"
                          : "var(--colors-richBlack-600)",
                      color: "white",
                      cursor:
                        !customText.trim() || interactionDisabled
                          ? "not-allowed"
                          : "pointer",
                      textShadow: "1px 1px 0px #000",
                      transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                      opacity: !customText.trim() || interactionDisabled ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (customText.trim() && !interactionDisabled) {
                        e.currentTarget.style.background = "white";
                        e.currentTarget.style.color =
                          "var(--colors-richBlack-800)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (customText.trim() && !interactionDisabled) {
                        e.currentTarget.style.background =
                          "var(--colors-richBlack-600)";
                        e.currentTarget.style.color = "white";
                      }
                    }}
                  >
                    きめる
                  </button>
                </HStack>
              </VStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </>
  );
}
