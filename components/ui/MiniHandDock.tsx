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
import type { ShowtimeIntentHandlers } from "@/lib/showtime/types";
import { isTopicType, type TopicType } from "@/lib/topics";
import type { PlayerDoc } from "@/lib/types";
import { UI_TOKENS, UNIFIED_LAYOUT } from "@/theme/layout";
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
import { keyframes } from "@emotion/react";
import Image from "next/image";
import React from "react";
import { FiEdit2, FiLogOut, FiSettings } from "react-icons/fi";
import { DiamondNumberCard } from "./DiamondNumberCard";
import { HD2DLoadingSpinner } from "./HD2DLoadingSpinner";
import { KEYBOARD_KEYS } from "./hints/constants";
import { SeinoButton } from "./SeinoButton";

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

// ========================================
// 🎬 Ambient Animations - 人の手感（不等間隔・微妙なゆらぎ）
// ========================================
// オレンジ系アンビエント（ゲーム開始ボタン用）
const orangeGlowStart = keyframes`
  0% {
    box-shadow: 0 0 0 2px rgba(220,95,25,0.8), 5px 6px 0 rgba(0,0,0,.42), 4px 5px 0 rgba(0,0,0,.38), inset 0 2px 0 rgba(255,255,255,.22), inset 0 -2px 1px rgba(0,0,0,.28), 0 0 18px rgba(255,145,65,0.3);
  }
  32% {
    box-shadow: 0 0 0 2px rgba(230,105,35,0.85), 5px 6px 0 rgba(0,0,0,.42), 4px 5px 0 rgba(0,0,0,.38), inset 0 2px 0 rgba(255,255,255,.24), inset 0 -2px 1px rgba(0,0,0,.28), 0 0 22px rgba(255,155,75,0.42);
  }
  61% {
    box-shadow: 0 0 0 2px rgba(240,115,45,0.88), 5px 6px 0 rgba(0,0,0,.42), 4px 5px 0 rgba(0,0,0,.38), inset 0 2px 0 rgba(255,255,255,.26), inset 0 -2px 1px rgba(0,0,0,.28), 0 0 26px rgba(255,165,85,0.52);
  }
  87% {
    box-shadow: 0 0 0 2px rgba(225,100,30,0.82), 5px 6px 0 rgba(0,0,0,.42), 4px 5px 0 rgba(0,0,0,.38), inset 0 2px 0 rgba(255,255,255,.23), inset 0 -2px 1px rgba(0,0,0,.28), 0 0 20px rgba(255,150,70,0.38);
  }
  100% {
    box-shadow: 0 0 0 2px rgba(220,95,25,0.8), 5px 6px 0 rgba(0,0,0,.42), 4px 5px 0 rgba(0,0,0,.38), inset 0 2px 0 rgba(255,255,255,.22), inset 0 -2px 1px rgba(0,0,0,.28), 0 0 18px rgba(255,145,65,0.3);
  }
`;

// オレンジ系アンビエント（次のゲーム用 - 少し控えめ）
const orangeGlowNext = keyframes`
  0% {
    box-shadow: 0 0 0 2px rgba(220,95,25,0.8), 5px 6px 0 rgba(0,0,0,.42), 4px 5px 0 rgba(0,0,0,.38), inset 0 2px 0 rgba(255,255,255,.22), inset 0 -2px 1px rgba(0,0,0,.28), 0 0 14px rgba(255,145,65,0.25);
  }
  38% {
    box-shadow: 0 0 0 2px rgba(230,105,35,0.84), 5px 6px 0 rgba(0,0,0,.42), 4px 5px 0 rgba(0,0,0,.38), inset 0 2px 0 rgba(255,255,255,.23), inset 0 -2px 1px rgba(0,0,0,.28), 0 0 18px rgba(255,155,75,0.35);
  }
  69% {
    box-shadow: 0 0 0 2px rgba(235,110,40,0.86), 5px 6px 0 rgba(0,0,0,.42), 4px 5px 0 rgba(0,0,0,.38), inset 0 2px 0 rgba(255,255,255,.24), inset 0 -2px 1px rgba(0,0,0,.28), 0 0 20px rgba(255,160,80,0.4);
  }
  91% {
    box-shadow: 0 0 0 2px rgba(225,100,30,0.82), 5px 6px 0 rgba(0,0,0,.42), 4px 5px 0 rgba(0,0,0,.38), inset 0 2px 0 rgba(255,255,255,.23), inset 0 -2px 1px rgba(0,0,0,.28), 0 0 16px rgba(255,150,70,0.3);
  }
  100% {
    box-shadow: 0 0 0 2px rgba(220,95,25,0.8), 5px 6px 0 rgba(0,0,0,.42), 4px 5px 0 rgba(0,0,0,.38), inset 0 2px 0 rgba(255,255,255,.22), inset 0 -2px 1px rgba(0,0,0,.28), 0 0 14px rgba(255,145,65,0.25);
  }
`;

const phaseMessagePulse = keyframes`
  0% {
    opacity: 0.6;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-1.5px);
  }
  100% {
    opacity: 0.6;
    transform: translateY(0);
  }
`;

const subtleTextPulse = keyframes`
  0% {
    opacity: 0.6;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-1px);
  }
  100% {
    opacity: 0.6;
    transform: translateY(0);
  }
`;

const noopCleanup = () => {};
type RevealAnimatingEvent = CustomEvent<{
  roomId?: string;
  animating?: boolean;
}>;
type DefaultTopicTypeChangeEvent = CustomEvent<{ defaultTopicType?: string }>;
// ========================================
// 🎨 Design System: Button Styles
// ========================================
/**
 * ドラクエ風フッターボタンの共通スタイル定数
 *
 * 設計方針:
 * - DRY原則に従い、重複を排除
 * - 保守性向上のため一箇所で管理
 * - ドラクエ風UI統一デザイン（角ばった・モノスペース・立体感）
 */
const FOOTER_BUTTON_BASE_STYLES = {
  // サイズ
  px: "14px",
  py: "10px",
  w: "68px",
  minW: "68px",

  // 背景・枠線
  bg: "rgba(28,32,42,0.95)",
  border: "none",
  borderRadius: "0",

  // タイポグラフィ
  fontWeight: "900",
  fontFamily: "'Courier New', monospace",
  fontSize: "15px",
  letterSpacing: "0.06em",
  textShadow: "1px 1px 0 rgba(0,0,0,0.9)",

  // 立体感演出
  boxShadow:
    "3px 3px 0 rgba(0,0,0,.65), inset 2px 2px 0 rgba(255,255,255,0.15), inset -2px -2px 0 rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.88)",
  transform: "translate(.5px,-.5px)",

  // レイアウト
  display: "flex",
  alignItems: "center",
  justifyContent: "center",

  // アニメーション
  transition: "177ms cubic-bezier(.2,1,.3,1)",

  // インタラクション状態
  _hover: {
    bg: "rgba(38,42,52,0.98)",
    transform: "translate(0,-1px)",
    boxShadow:
      "4px 4px 0 rgba(0,0,0,.7), inset 2px 2px 0 rgba(255,255,255,0.2), inset -2px -2px 0 rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.95)",
  },
  _active: {
    transform: "translate(1px,1px)",
    boxShadow:
      "2px 2px 0 rgba(0,0,0,.75), inset 2px 2px 0 rgba(255,255,255,0.1), inset -2px -2px 0 rgba(0,0,0,0.6), 0 0 0 2px rgba(255,255,255,0.82)",
  },
  _disabled: {
    bg: "rgba(28,32,42,0.5)",
    color: "rgba(255,255,255,0.4)",
    filter: "grayscale(0.8)",
    cursor: "not-allowed",
    boxShadow:
      "2px 2px 0 rgba(0,0,0,.4), inset 1px 1px 0 rgba(255,255,255,0.05), inset -1px -1px 0 rgba(0,0,0,0.3), 0 0 0 2px rgba(255,255,255,0.3)",
  },
} as const;

/**
 * せーの！ボタンスタイル（ゲーム開始・次のゲームボタンと共通）
 *
 * 設計方針:
 * - SeinoButtonと完全に統一されたデザイン
 * - オレンジ系のドラクエ風デザイン
 * - 立体感のある演出
 */
const SEINO_BUTTON_STYLES = {
  minW: "211px",
  px: "34px",
  py: "19px",
  position: "relative" as const,
  bg: "rgba(255,128,45,0.93)",
  color: "white",
  border: "3px solid rgba(255,255,255,0.92)",
  borderRadius: 0,
  fontWeight: "800",
  fontFamily: "monospace",
  fontSize: "26px",
  letterSpacing: "0.023em",
  textShadow: "2px 3px 0px rgba(0,0,0,0.85), 1px 1px 2px rgba(0,0,0,0.6)",
  boxShadow:
    "0 0 0 2px rgba(220,95,25,0.8), 5px 6px 0 rgba(0,0,0,.42), 4px 5px 0 rgba(0,0,0,.38), inset 0 2px 0 rgba(255,255,255,.22), inset 0 -2px 1px rgba(0,0,0,.28)",
  _before: {
    content: '""',
    position: "absolute" as const,
    top: "3px",
    left: "4px",
    right: "3px",
    bottom: "3px",
    background:
      "linear-gradient(178deg, rgba(255,255,255,0.12) 0%, transparent 48%, rgba(0,0,0,0.18) 100%)",
    pointerEvents: "none" as const,
  },
  _hover: {
    bg: "rgba(255,145,65,0.96)",
    color: "white",
    textShadow: "2px 3px 0px rgba(0,0,0,0.92), 1px 2px 3px rgba(0,0,0,0.65)",
    borderColor: "rgba(255,255,255,0.95)",
    transform: "translateY(-3px)",
    boxShadow:
      "0 0 0 2px rgba(235,110,35,0.85), 6px 8px 0 rgba(0,0,0,.48), 5px 7px 0 rgba(0,0,0,.4), inset 0 2px 0 rgba(255,255,255,.28)",
  },
  _active: {
    bg: "rgba(235,110,30,0.95)",
    color: "rgba(255,255,255,0.91)",
    boxShadow:
      "0 0 0 2px rgba(200,85,20,0.82), 2px 3px 0 rgba(0,0,0,.46), inset 0 2px 0 rgba(255,255,255,.14)",
    transform: "translateY(1px)",
  },
} as const;

interface MiniHandDockProps {
  roomId: string;
  me: (PlayerDoc & { id: string }) | undefined;
  resolveMode?: ResolveMode | null;
  proposal?: (string | null)[];
  eligibleIds?: string[];
  cluesReady?: boolean;
  isHost?: boolean;
  roomStatus?: string;
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
  phaseMessage?: string | null;
  roundPreparing?: boolean;
  showtimeIntentHandlers?: ShowtimeIntentHandlers;
  updateOptimisticProposalOverride?: (
    playerId: string,
    state: "placed" | "removed" | null
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
    phaseMessage,
    roundPreparing = false,
    showtimeIntentHandlers,
    updateOptimisticProposalOverride,
  } = props;

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
  const [inlineFeedback, setInlineFeedback] = React.useState<{
    message: string;
    tone: "info" | "success";
  } | null>(null);
  const [topicActionLoading, setTopicActionLoading] = React.useState(false);
  const [dealActionLoading, setDealActionLoading] = React.useState(false);

  // 入力フィールド参照
  const inputRef = React.useRef<HTMLInputElement>(null);

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
    roomStatus,
    player: me ?? null,
    inputRef,
    onFeedback: setInlineFeedback,
  });

  const {
    actualResolveMode,
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
    roomStatus,
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

  const {
    autoStartLocked,
    beginLock: beginAutoStartLock,
    clearLock: clearAutoStartLock,
  } = useHostAutoStartLock(roomId, roomStatus);

  const {
    quickStart,
    quickStartPending,
    isResetting,
    isRestarting,
    resetGame,
    handleNextGame,
    evalSorted,
    customOpen,
    setCustomOpen,
    customText,
    setCustomText,
    handleSubmitCustom,
    effectiveDefaultTopicType: hostDefaultTopicType,
  } = useHostActionsCore({
    roomId,
    roomStatus,
    isHost: !!isHost,
    isRevealAnimating,
    autoStartLocked,
    beginAutoStartLock,
    clearAutoStartLock,
    actualResolveMode,
    defaultTopicType: computedDefaultTopicType,
    roundIds,
    onlineUids,
    playerCount,
    proposal,
    currentTopic,
    presenceReady,
    onFeedback: setInlineFeedback,
    showtimeIntents: showtimeIntentHandlers,
  });

  const effectiveDefaultTopicType = hostDefaultTopicType;

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
    !!isHost && isSortMode && roomStatus === "clue" && allSubmitted;

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
  const clearButtonDisabled = !clueEditable || !hasText || placed;
  const clearTooltip = !clueEditable
    ? "判定中は操作できません"
    : placed
      ? "カード提出中は操作できません"
      : !displayHasText
        ? "連想ワードが入力されていません"
        : "連想ワードをクリア";
  const decideTooltip = !clueEditable
    ? "判定中は操作できません"
    : !displayHasText
      ? "連想ワードを入力してください"
      : "連想ワードを決定";
  const submitDisabledReason = !clueEditable
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
  const submitTooltip = canClickProposalButton
    ? baseActionTooltip
    : submitDisabledReason;

  const _playLedgerOpen = useSoundEffect("ledger_open"); // reserved (ledger button hidden)
  const playCardDeal = useSoundEffect("card_deal");
  const playTopicShuffle = useSoundEffect("topic_shuffle");
  const showQuickStartProgress =
    (quickStartPending || autoStartLocked || roundPreparing) &&
    (roomStatus === "waiting" || roomStatus === "clue");

  const preparing = !!(
    autoStartLocked ||
    quickStartPending ||
    isRestarting ||
    isResetting
  );
  const isGameFinished = roomStatus === "finished";
  // 戦績ボタンは MiniHandDock 側では表示しない（MinimalChat 側に一本化）
  const showLedgerButton = false;

  return (
    <>
      {/* 🔥 せーの！ボタン（フッター外の浮遊ボタン - Octopath風） */}
      {shouldShowSeinoButton && !hideHandUI && (
        <SeinoButton
          isVisible
          disabled={!allSubmitted}
          onClick={async () => {
            try {
              await evalSorted();
              beginReveal();
            } catch {
              endReveal();
            }
          }}
        />
      )}

      {/* ゲーム開始ボタン (フッターパネルとWaitingカードの間) */}
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
          // HD-2D風: 石板/古文書風の背景（夜の儀式パネル）
          bg="linear-gradient(178deg, rgba(28, 24, 20, 0.96) 0%, rgba(18, 15, 12, 0.94) 100%)"
          border="3px solid rgba(255,255,255,0.88)"
          borderRadius="0"
          // v1: 余白は4の倍数だけでなく微差を許容
          px="19px"
          py="13px"
          // HD-2D風: 多層シャドウ（石板の重み＋月光のほのかな反射）
          boxShadow={`
            0 1px 0 rgba(0,0,0,.08),
            0 10px 20px -8px rgba(0,0,0,.55),
            3px 4px 0 rgba(0,0,0,0.75),
            5px 6px 0 rgba(0,0,0,0.5),
            inset 1px 1px 0 rgba(255,240,200,0.08),
            inset -1px -1px 0 rgba(0,0,0,0.3)
          `}
          pointerEvents="none"
          css={{
            // 内側の金色装飾ライン（v2: 石板に細い黄金の装飾ライン）
            "&::before": {
              content: '""',
              position: "absolute",
              inset: "4px",
              border: "1px solid rgba(212, 175, 90, 0.38)",
              pointerEvents: "none",
            },
          }}
        >
          <HStack gap="11px" align="center">
            <HD2DLoadingSpinner size="32px" />
            <Text
              // v2: 黄金寄りの色＋軽いテキストシャドウで「儀式感」
              fontSize="0.9rem"
              fontWeight="bold"
              color="rgba(255, 245, 215, 0.95)"
              letterSpacing="0.035em"
              fontFamily="monospace"
              textShadow="0 1px 2px rgba(0,0,0,0.85), 0 0 8px rgba(255,230,180,0.15)"
            >
              カードを配布しています…
            </Text>
          </HStack>
        </Box>
      )}

      {roomStatus === "waiting" &&
        !preparing &&
        (isHost || hostClaimActive) && (
          <Box
            position="fixed"
            bottom={{
              base: "clamp(120px, 18vh, 220px)",
              md: "clamp(130px, 16vh, 240px)",
            }}
            left="50%"
            transform="translateX(-50%)"
            zIndex={55}
            css={{
              [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                bottom: "clamp(100px, 15vh, 180px)",
              },
            }}
          >
            {isHost ? (
              <AppButton
                {...SEINO_BUTTON_STYLES}
                size="lg"
                visual="solid"
                onClick={() => quickStart()}
                disabled={!presenceReady || quickStartPending}
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
            {isHost && !presenceReady ? (
              <Text
                mt={2}
                fontSize="xs"
                fontWeight="bold"
                color="rgba(255,255,255,0.75)"
                textAlign="center"
              >
                参加者の接続を待っています…
              </Text>
            ) : null}
          </Box>
        )}

      {/* 次のゲームボタン (フッターパネルとカードの間) */}
      {isHost &&
        ((roomStatus === "reveal" && !!allowContinueAfterFail) ||
          roomStatus === "finished") &&
        !autoStartLocked &&
        !isRestarting &&
        !(roomStatus === "reveal" && isRevealAnimating) && (
          <Box
            position="fixed"
            bottom={{
              base: "clamp(120px, 18vh, 220px)",
              md: "clamp(130px, 16vh, 240px)",
            }}
            left="50%"
            transform="translateX(-50%)"
            zIndex={55}
            css={{
              [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                bottom: "clamp(100px, 15vh, 180px)",
              },
            }}
          >
            <AppButton
              {...SEINO_BUTTON_STYLES}
              size="lg"
              visual="solid"
              onClick={handleNextGame}
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
          bottom={{ base: "20px", md: "24px" }}
          left="50%"
          transform="translateX(-50%)"
          zIndex={50}
          data-guide-target="mini-hand-dock"
          gap={{ base: "10px", md: "14px" }}
          align="center"
          justify="center"
          flexWrap="nowrap"
          maxW="95vw"
          css={{
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
              bottom: "16px",
              gap: "8px",
            },
          }}
        >
          {/* 数字カード（大きく・モダン） */}
          <Box
            flexShrink={0}
            transform={{ base: "scale(1.1)", md: "scale(1.2)" }}
            transformOrigin="left center"
            mr={{ base: "14px", md: "20px" }}
            css={{
              [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                transform: "scale(1.0)",
                marginRight: "12px",
              },
            }}
          >
            {/* revealゲート中は上位の条件でDOM未描画 */}
            <DiamondNumberCard number={me?.number || null} isAnimating={pop} />
          </Box>

          {/* 入力エリア（常時表示・シームレス） */}
          <HStack gap={{ base: "8px", md: "10px" }} flexWrap="nowrap">
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
              fontSize={{ base: "14px", md: "16px" }}
              fontWeight="700"
              letterSpacing="0.02em"
              border="none"
              borderRadius="3px"
              boxShadow="inset 2px 2px 0 rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.25)"
              minH={{ base: "44px", md: "48px" }}
              w={{ base: "200px", md: "280px" }}
              transition="box-shadow 150ms ease"
              disabled={!clueEditable}
              css={{
                [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
                  minHeight: "40px",
                  width: "220px",
                  fontSize: "14px",
                },
              }}
              _placeholder={{
                color: "rgba(255,255,255,0.35)",
              }}
              _focus={{
                boxShadow:
                  "inset 2px 2px 0 rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.4)",
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
                disabled={!canDecide}
                w="auto"
                minW="60px"
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
                disabled={clearButtonDisabled}
                w="auto"
                minW="60px"
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
                disabled={!canClickProposalButton}
                w="auto"
                minW="70px"
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
                    (isGameFinished && effectiveDefaultTopicType !== "カスタム")
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
                  disabled={dealActionLoading || isGameFinished}
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
                  disabled={isResetting}
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
      {(inlineFeedback || phaseMessage) && (
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
            {inlineFeedback ? inlineFeedback.message : phaseMessage}
          </Text>
        </Box>
      )}

      {/* 右端: 共通ボタン (設定・退出のみ) */}
      <Box
        position="fixed"
        bottom={{ base: "16px", md: "20px" }}
        right={{ base: "32px", md: "32px" }}
        zIndex={50}
        css={{
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            bottom: "14px",
            right: "32px",
          },
        }}
      >
        <HStack gap="10px" align="center">
          {/* 非ホストでもカスタムモード時は"ペン"を表示（待機/連想フェーズのみ） */}
          {!isHost &&
            isCustomModeSelectable &&
            (roomStatus === "waiting" || roomStatus === "clue") && (
              <Tooltip content="カスタムお題を設定" showArrow openDelay={300}>
                <IconButton
                  aria-label="カスタムお題"
                  onClick={() => {
                    setCustomText(currentTopic || "");
                    setCustomOpen(true);
                  }}
                  size="sm"
                  w="40px"
                  h="40px"
                  bg="rgba(28,32,42,0.95)"
                  color="rgba(255,255,255,0.92)"
                  borderWidth="0"
                  borderRadius="0"
                  fontFamily="'Courier New', monospace"
                  fontSize="16px"
                  boxShadow="2px 2px 0 rgba(0,0,0,.65), 0 0 0 2px rgba(255,255,255,0.88)"
                  _hover={{
                    bg: "rgba(38,42,52,0.98)",
                    color: "rgba(255,255,255,1)",
                    transform: "translate(0,-1px)",
                    boxShadow:
                      "3px 3px 0 rgba(0,0,0,.7), 0 0 0 2px rgba(255,255,255,0.95)",
                  }}
                  _active={{
                    transform: "translate(1px,1px)",
                    boxShadow:
                      "1px 1px 0 rgba(0,0,0,.75), 0 0 0 2px rgba(255,255,255,0.82)",
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
                w="36px"
                h="36px"
                bg="rgba(28,32,42,0.95)"
                color="rgba(255,255,255,0.92)"
                borderWidth="0"
                borderRadius="0"
                fontFamily="'Courier New', monospace"
                fontSize="15px"
                boxShadow="2px 2px 0 rgba(0,0,0,.65), 0 0 0 2px rgba(255,255,255,0.88)"
                _hover={{
                  bg: "rgba(38,42,52,0.98)",
                  color: "rgba(255,255,255,1)",
                  transform: "translate(0,-1px)",
                  boxShadow:
                    "3px 3px 0 rgba(0,0,0,.7), 0 0 0 2px rgba(255,255,255,0.95)",
                }}
                _active={{
                  transform: "translate(1px,1px)",
                  boxShadow:
                    "1px 1px 0 rgba(0,0,0,.75), 0 0 0 2px rgba(255,255,255,0.82)",
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
                w="36px"
                h="36px"
                bg="rgba(28,32,42,0.95)"
                color="rgba(255,255,255,0.92)"
                borderWidth="0"
                borderRadius="0"
                fontFamily="'Courier New', monospace"
                fontSize="15px"
                boxShadow="2px 2px 0 rgba(0,0,0,.65), 0 0 0 2px rgba(255,255,255,0.88)"
                _hover={{
                  bg: "rgba(52,28,28,0.98)",
                  color: "rgba(255,220,220,1)",
                  transform: "translate(0,-1px)",
                  boxShadow:
                    "3px 3px 0 rgba(0,0,0,.7), 0 0 0 2px rgba(255,180,180,0.95)",
                }}
                _active={{
                  transform: "translate(1px,1px)",
                  boxShadow:
                    "1px 1px 0 rgba(0,0,0,.75), 0 0 0 2px rgba(255,180,180,0.82)",
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
                    onClick={() =>
                      customText.trim() && handleSubmitCustom(customText)
                    }
                    disabled={!customText.trim()}
                    style={{
                      minWidth: "140px",
                      height: "40px",
                      borderRadius: 0,
                      fontWeight: "bold",
                      fontSize: "1rem",
                      fontFamily: "monospace",
                      border: "borders.retrogameThin",
                      background: !customText.trim()
                        ? "#666"
                        : "var(--colors-richBlack-600)",
                      color: "white",
                      cursor: !customText.trim() ? "not-allowed" : "pointer",
                      textShadow: "1px 1px 0px #000",
                      transition: `background-color 0.1s ${UI_TOKENS.EASING.standard}, color 0.1s ${UI_TOKENS.EASING.standard}, border-color 0.1s ${UI_TOKENS.EASING.standard}`,
                      opacity: !customText.trim() ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (customText.trim()) {
                        e.currentTarget.style.background = "white";
                        e.currentTarget.style.color =
                          "var(--colors-richBlack-800)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (customText.trim()) {
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
