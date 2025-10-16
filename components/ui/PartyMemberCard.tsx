"use client";

import Tooltip from "@/components/ui/Tooltip";
import { Box, Spinner, Text } from "@chakra-ui/react";
import { gsap } from "gsap";
import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { keyframes } from "@emotion/react";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const pulseSweep = keyframes`
  0% { transform: translateX(-100%); }
  50% { transform: translateX(100%); }
  100% { transform: translateX(-100%); }
`;

export type PartyMember = {
  id: string;
  name: string;
  avatar: string;
  number: number | null;
  clue1: string;
  ready: boolean;
  orderIndex: number;
  uid?: string;
  [key: string]: any;
};

export type PartyStatusTone =
  | "submitted"
  | "clue-entered"
  | "clue-pending"
  | "waiting"
  | "reveal"
  | "finished"
  | "default";

// HD-2D風：部屋名と統一感のある背景
const CARD_BACKGROUND = "rgba(12,14,20,0.35)";
const CARD_HOVER_BACKGROUND = "rgba(18,24,34,0.45)";
const CARD_BOX_SHADOW = "0 1px 4px rgba(0,0,0,0.12)";
const CARD_HOVER_BOX_SHADOW = "0 2px 6px rgba(0,0,0,0.18)";
const CARD_FLASH_SHADOW =
  "0 2px 8px rgba(255,255,255,0.3), 0 4px 16px rgba(255,255,255,0.2), inset 0 1px 0 rgba(255,255,255,0.5)";
const CLUE_FLASH_BRIGHTNESS = 1.28;
const CARD_HEIGHT = "52px";
const CARD_HEIGHT_DPI125 = "46px";
const CARD_AVATAR_SIZE = "44px";
const CARD_AVATAR_SIZE_DPI125 = "40px";
const CARD_RADIUS = "3px";
const CARD_HOVER_LIFT = "-1.5px";
const actionableHoverStyle = {
  bg: CARD_HOVER_BACKGROUND,
  transform: `translateY(${CARD_HOVER_LIFT})`,
  boxShadow: CARD_HOVER_BOX_SHADOW,
} as const;

const passiveHoverStyle = {
  bg: CARD_HOVER_BACKGROUND,
  transform: "translateY(-0.5px)",
  boxShadow: "0 4px 10px rgba(0,0,0,0.32)",
} as const;

type PartyMemberCardProps = {
  player: PartyMember;
  roomStatus: string;
  isHost: boolean;
  isSubmitted: boolean;
  shouldRevealNumbers: boolean;
  canTransfer: boolean;
  onTransfer?: () => void;
  isTransferPending?: boolean;
};

const getPlayerStatus = (
  player: PartyMember,
  roomStatus: string,
  submitted: boolean
): { icon: string; status: string; tone: PartyStatusTone } => {
  if (roomStatus === "clue") {
    if (submitted) {
      return { icon: "✅", status: "提出済み", tone: "submitted" };
    }
    if (player.clue1 && player.clue1.trim() !== "") {
      return { icon: "📝", status: "連想OK", tone: "clue-entered" };
    }
    return { icon: "💡", status: "考え中", tone: "clue-pending" };
  }

  if (roomStatus === "waiting") {
    return { icon: "🛡️", status: "待機中", tone: "waiting" };
  }

  if (roomStatus === "reveal") {
    return { icon: "🎲", status: "判定中", tone: "reveal" };
  }

  if (roomStatus === "finished") {
    return { icon: "🏆", status: "結果発表", tone: "finished" };
  }

  return { icon: "🎲", status: "参加中", tone: "default" };
};

const runClueFlash = (node: HTMLDivElement) => {
  const timeline = gsap
    .timeline({ defaults: { overwrite: "auto" } })
    .to(node, {
      duration: 0.18,
      filter: `brightness(${CLUE_FLASH_BRIGHTNESS})`,
      boxShadow: CARD_FLASH_SHADOW,
      ease: "power2.out",
    })
    .to(node, {
      duration: 0.28,
      filter: "brightness(1)",
      boxShadow: CARD_BOX_SHADOW,
      ease: "power3.out",
      onComplete: () => {
        gsap.set(node, { clearProps: "filter" });
      },
    });

  return timeline;
};

const runSubmitFlash = (node: HTMLDivElement) => {
  const timeline = gsap
    .timeline({ defaults: { overwrite: "auto" } })
    .to(node, {
      duration: 0.05,
      background: "rgba(255,255,255,0.95)",
      boxShadow: CARD_FLASH_SHADOW,
      transform: "scale(1.03)",
      ease: "none",
    })
    .to(node, {
      duration: 0.03,
      background: "rgba(200,220,240,0.8)",
      transform: "scale(0.99)",
      ease: "none",
    })
    .to(node, {
      duration: 0.06,
      background: "rgba(255,245,200,0.9)",
      transform: "scale(1.02)",
      ease: "none",
    })
    .to(node, {
      duration: 0.04,
      background: "rgba(180,200,220,0.7)",
      transform: "scale(0.995)",
      ease: "none",
    })
    .to(node, {
      duration: 0.15,
      background: CARD_BACKGROUND,
      boxShadow: CARD_BOX_SHADOW,
      transform: "scale(1)",
      ease: "power2.out",
      onComplete: () => {
        gsap.set(node, { clearProps: "background,transform" });
      },
    });

  return timeline;
};

const useReducedMotionPreference = (): boolean => {
  const { reducedMotion } = useAnimationSettings();
  return reducedMotion;
};

export const PartyMemberCard = memo(function PartyMemberCard({
  player,
  roomStatus,
  isHost,
  isSubmitted,
  shouldRevealNumbers,
  canTransfer,
  onTransfer,
  isTransferPending,
}: PartyMemberCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const previousClueRef = useRef<string>("");
  const previousSubmittedRef = useRef<boolean>(false);
  const prefersReducedMotion = useReducedMotionPreference();

  const trimmedClue = useMemo(
    () => (player.clue1 ? player.clue1.trim() : ""),
    [player.clue1]
  );
  const hasClue = trimmedClue.length > 0;
  const playerNumberValue =
    typeof player.number === "number" ? player.number : null;
  const revealNumber = shouldRevealNumbers && playerNumberValue !== null;
  const clueRevealed = isSubmitted || revealNumber;
  const gaugeFillWidth = isSubmitted
    ? "100%"
    : hasClue
    ? "60%"
    : "0%";

  const clueDisplay = useMemo(() => {
    if (clueRevealed) {
      return trimmedClue.length > 0 ? `「${trimmedClue}」` : "連想ワード未入力";
    }
    if (hasClue) {
      return "準備中...";
    }
    return "連想ワード未入力";
  }, [clueRevealed, trimmedClue, hasClue]);

  const clueTitle = clueRevealed
    ? trimmedClue || "連想ワード未入力"
    : hasClue
    ? "準備中..."
    : "連想ワード未入力";

  const statusMeta = useMemo(
    () => getPlayerStatus(player, roomStatus, isSubmitted),
    [player, roomStatus, isSubmitted]
  );
  const hoverStyle = canTransfer ? actionableHoverStyle : passiveHoverStyle;

  useEffect(() => {
    const node = cardRef.current;
    const previousClue = previousClueRef.current;
    previousClueRef.current = trimmedClue;

    if (prefersReducedMotion || !node) return;
    if (!previousClue && trimmedClue) {
      const timeline = runClueFlash(node);
      return () => {
        timeline.kill();
      };
    }
  }, [prefersReducedMotion, trimmedClue]);

  useEffect(() => {
    const node = cardRef.current;
    const wasSubmitted = previousSubmittedRef.current;
    previousSubmittedRef.current = isSubmitted;

    if (prefersReducedMotion || !node) return;
    if (!wasSubmitted && isSubmitted) {
      const timeline = runSubmitFlash(node);
      return () => {
        timeline.kill();
      };
    }
  }, [prefersReducedMotion, isSubmitted]);

  const handleDoubleClick = useCallback(() => {
    if (!canTransfer || !onTransfer) return;
    onTransfer();
  }, [canTransfer, onTransfer]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!canTransfer || !onTransfer) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onTransfer();
      }
    },
    [canTransfer, onTransfer]
  );

  const content = (
    <Box
      ref={cardRef}
      data-player-id={player.id}
      display="grid"
      gridTemplateColumns="auto 1fr auto"
      columnGap="11px"
      rowGap="3px"
      alignItems="center"
      borderRadius={CARD_RADIUS}
      minH={CARD_HEIGHT}
      border="1px solid"
      borderColor="rgba(255,255,255,0.08)"
      bg={CARD_BACKGROUND}
      boxShadow={CARD_BOX_SHADOW}
      px="13px"
      py="7px"
      transition="transform 180ms cubic-bezier(.2,1,.3,1), box-shadow 180ms cubic-bezier(.2,1,.3,1), background 180ms ease"
      css={{
        cursor: canTransfer ? "pointer" : "default",
        pointerEvents: "auto",
        backdropFilter: "blur(12px) saturate(1.18)",
        position: "relative",
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
          minHeight: CARD_HEIGHT_DPI125,
          paddingLeft: "11px",
          paddingRight: "11px",
          paddingTop: "6px",
          paddingBottom: "6px",
          columnGap: "9px",
        },
      }}
      _hover={hoverStyle}
      _focus={{ outline: "none" }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "focusRing",
        outlineOffset: "2px",
        boxShadow: "0 0 0 3px rgba(124, 185, 255, 0.35)",
      }}
      tabIndex={canTransfer ? 0 : undefined}
      role={canTransfer ? "button" : undefined}
      aria-label={
        canTransfer
          ? `ダブルクリックで ${player.name} にホストを委譲`
          : `${player.name} のステータス`
      }
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      <Box
        gridRow="1 / span 2"
        w={CARD_AVATAR_SIZE}
        h={CARD_AVATAR_SIZE}
        display="flex"
        alignItems="center"
        justifyContent="center"
        position="relative"
        borderRadius="2px"
        border="1px solid rgba(255,255,255,0.18)"
        bg="rgba(6,10,18,0.6)"
        css={{
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            width: CARD_AVATAR_SIZE_DPI125,
            height: CARD_AVATAR_SIZE_DPI125,
          },
        }}
      >
        {player.avatar?.startsWith("/avatars/") ? (
          <img
            src={player.avatar}
            alt="avatar"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter:
                "drop-shadow(0 1px 2px rgba(0,0,0,0.6)) contrast(1.08) saturate(1.05)",
            }}
          />
        ) : (
          <Text
            fontSize="xl"
            filter="drop-shadow(0 1px 3px rgba(0,0,0,0.7))"
          >
            {player.avatar || "⚔️"}
          </Text>
        )}
      </Box>

      <Box display="flex" alignItems="center" gap="6px" minW={0} lineHeight="1">
        {isTransferPending && <Spinner size="xs" color="accent" />}
        <Text
          fontSize="15px"
          fontWeight="600"
          color={isHost ? "rgba(255,220,140,0.95)" : "rgba(255,255,255,0.92)"}
          textShadow="0 1px 3px rgba(0,0,0,0.8)"
          fontFamily="system-ui"
          truncate
          title={`${isHost ? "ホスト: " : ""}${player.name}`}
          css={{
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
              fontSize: "13px",
            },
          }}
        >
          {player.name}
        </Text>
      </Box>

      <Box
        justifySelf="end"
        alignSelf="start"
        display="inline-flex"
        alignItems="center"
        gap="4px"
        px="6px"
        py="3px"
        borderRadius="2px"
        css={{
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            paddingLeft: "5px",
            paddingRight: "5px",
            paddingTop: "2px",
            paddingBottom: "2px",
          },
          background:
            statusMeta.tone === "submitted"
              ? "rgba(34, 197, 94, 0.18)"
              : statusMeta.tone === "clue-entered"
              ? "rgba(245, 158, 11, 0.18)"
              : "rgba(100, 116, 139, 0.15)",
          border: "1px solid",
          borderColor:
            statusMeta.tone === "submitted"
              ? "rgba(34, 197, 94, 0.35)"
              : statusMeta.tone === "clue-entered"
              ? "rgba(245, 158, 11, 0.35)"
              : "rgba(100, 116, 139, 0.25)",
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.2)",
        }}
      >
        <Box
          as="span"
          fontSize="xs"
          lineHeight="1"
          css={{
            filter:
              statusMeta.tone === "submitted"
                ? "drop-shadow(0 0 2px rgba(34, 197, 94, 0.6))"
                : statusMeta.tone === "clue-entered"
                ? "drop-shadow(0 0 2px rgba(245, 158, 11, 0.6))"
                : "drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5))",
          }}
        >
          {statusMeta.icon}
        </Box>
        <Text
          fontSize="11px"
          fontWeight="600"
          letterSpacing="0.02em"
          css={{
            color:
              statusMeta.tone === "submitted"
                ? "#86EFAC"
                : statusMeta.tone === "clue-entered"
                ? "#FCD34D"
                : "#CBD5E1",
            textShadow:
              statusMeta.tone === "submitted" || statusMeta.tone === "clue-entered"
                ? "0 0 4px rgba(0, 0, 0, 0.6), 0 1px 2px rgba(0, 0, 0, 0.8)"
                : "0 1px 2px rgba(0, 0, 0, 0.7)",
          }}
        >
          {statusMeta.status}
        </Text>
      </Box>

      <Box gridColumn="2 / span 2" display="flex" flexDirection="column" gap="3px" minW={0}>
        <Text
          fontSize="11px"
          color="rgba(200,210,220,0.72)"
          fontStyle={clueRevealed && trimmedClue ? "italic" : "normal"}
          lineHeight="1.2"
          truncate
          title={clueTitle}
        >
          {clueDisplay}
        </Text>
        <Box display="flex" alignItems="center" gap="7px">
          <Box
            flex={1}
            h="6px"
            minH="6px"
            bg="rgba(8,12,18,0.85)"
            borderRadius="1px"
            overflow="hidden"
            border="1px solid rgba(80,110,150,0.22)"
            position="relative"
            maxW="138px"
            css={{
              boxShadow:
                "inset 0 1px 2px rgba(0,0,0,0.6), 0 0.5px 1px rgba(0,0,0,0.4)",
            }}
          >
            <Box
              height="100%"
              width={gaugeFillWidth}
              bg={
                isSubmitted
                  ? "#22C55E"
                  : hasClue
                  ? "#F59E0B"
                  : "transparent"
              }
              transition="all 0.35s cubic-bezier(0.32, 0.94, 0.44, 1)"
              position="relative"
              css={{
                boxShadow: isSubmitted
                  ? "0 0 4px rgba(34,197,94,0.5), inset 0 0.5px 0 rgba(255,255,255,0.2)"
                  : hasClue
                  ? "0 0 4px rgba(245,158,11,0.4), inset 0 0.5px 0 rgba(255,255,255,0.18)"
                  : "none",
              }}
            />
            {isSubmitted && (
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                bottom="0"
                bg="linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)"
                css={{
                  animation: `${pulseSweep} 2.1s ease-in-out infinite`,
                }}
                pointerEvents="none"
              />
            )}
          </Box>

          <Box
            minW="26px"
            h="16px"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text
              fontSize="11px"
              color="rgba(180,220,255,0.92)"
              textShadow="0 1px 3px rgba(0,0,0,0.7)"
              fontFamily="mono"
              fontWeight="700"
              letterSpacing="0.02em"
              textAlign="center"
              opacity={revealNumber ? 1 : 0}
              transition="opacity 0.24s ease"
              aria-hidden={!revealNumber}
            >
              {playerNumberValue !== null ? playerNumberValue : "00"}
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  if (!canTransfer) {
    return content;
  }

  return (
    <Tooltip
      content={`ダブルクリックで ${player.name} にホスト権限を譲渡`}
      openDelay={200}
      showArrow
    >
      {content}
    </Tooltip>
  );
});

