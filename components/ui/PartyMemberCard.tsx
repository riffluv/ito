"use client";

import Tooltip from "@/components/ui/Tooltip";
import { Box, Spinner, Text } from "@chakra-ui/react";
import { gsap } from "gsap";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

const CARD_BACKGROUND =
  "linear-gradient(142deg, rgba(17,27,40,0.91) 0%, rgba(13,21,36,0.94) 38%, rgba(9,16,29,0.96) 68%, rgba(6,13,23,0.97) 100%)";
const CARD_HOVER_BACKGROUND =
  "linear-gradient(148deg, rgba(26,36,53,0.95) 0%, rgba(21,31,47,0.97) 41%, rgba(17,27,41,0.98) 72%, rgba(14,24,37,0.99) 100%)";
const CARD_BOX_SHADOW =
  "0 2px 4px rgba(0,0,0,0.3), 0 6px 12px rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.8)";
const CARD_HOVER_BOX_SHADOW =
  "0 4px 8px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.6), 0 16px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.9)";
const CARD_FLASH_SHADOW =
  "0 6px 12px rgba(255,255,255,0.3), 0 12px 24px rgba(255,255,255,0.2), 0 18px 36px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.4)";
const CLUE_FLASH_BRIGHTNESS = 1.4;
const CARD_HEIGHT = "56px";
const CARD_AVATAR_SIZE = "44px";
const CARD_RADIUS = "4px";
const CARD_HOVER_LIFT = "-3px";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const actionableHoverStyle = {
  bg: CARD_HOVER_BACKGROUND,
  transform: `translateY(${CARD_HOVER_LIFT})`,
  boxShadow: CARD_HOVER_BOX_SHADOW,
} as const;

const passiveHoverStyle = {
  bg: CARD_HOVER_BACKGROUND,
  transform: "translateY(-1px)",
  boxShadow: "0 6px 18px rgba(0,0,0,0.55)",
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
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const handler = () => setPrefersReducedMotion(mediaQuery.matches);
    handler();
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
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
      columnGap="8px"
      rowGap="2px"
      alignItems="center"
      borderRadius={CARD_RADIUS}
      minH={CARD_HEIGHT}
      border="1px solid"
      borderColor="borderSubtle"
      bg={CARD_BACKGROUND}
      boxShadow="card"
      px="12px"
      py="5px"
      transition="transform 0.16s var(--chakra-easings-stateInOut, cubic-bezier(0.3, 0.7, 0.4, 1.1)), box-shadow 0.16s var(--chakra-easings-stateInOut, cubic-bezier(0.3, 0.7, 0.4, 1.1)), background 0.16s ease"
      css={{
        cursor: canTransfer ? "pointer" : "default",
        pointerEvents: "auto",
        backdropFilter: "blur(8px) saturate(1.2)",
        position: "relative",
        "&::before": {
          content: "''",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background:
            "linear-gradient(87deg, rgba(115,155,195,0.14) 0%, rgba(175,195,215,0.38) 18%, rgba(215,235,250,0.68) 39%, rgba(188,208,228,0.46) 61%, rgba(125,165,205,0.17) 100%)",
          pointerEvents: "none",
          filter: "blur(0.6px)",
        },
        "&::after": {
          content: "''",
          position: "absolute",
          bottom: -3,
          left: "2px",
          right: "2px",
          height: "5px",
          background:
            "linear-gradient(92deg, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0.72) 19%, rgba(0,0,0,0.92) 47%, rgba(0,0,0,0.78) 76%, rgba(0,0,0,0.52) 100%)",
          opacity: 0.9,
          filter: "blur(1.5px)",
          pointerEvents: "none",
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
        css={{
          clipPath:
            "polygon(15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%, 0% 15%)",
          "&::before": {
            content: "''",
            position: "absolute",
            inset: "-2px",
            background:
              "linear-gradient(135deg, rgba(100,150,220,0.6) 0%, rgba(60,90,140,0.4) 50%, rgba(30,50,80,0.6) 100%)",
            clipPath:
              "polygon(15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%, 0% 15%)",
            zIndex: -1,
            filter: "blur(1px)",
          },
        }}
      >
        {player.avatar?.startsWith("/avatars/") ? (
          <img
            src={player.avatar}
            alt="avatar"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter:
                "drop-shadow(0 2px 4px rgba(0,0,0,0.8)) drop-shadow(0 4px 8px rgba(0,0,0,0.6)) contrast(1.15) saturate(1.1)",
            }}
          />
        ) : (
          <Text
            fontSize="2xl"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.9)) drop-shadow(0 4px 8px rgba(0,0,0,0.7))"
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
          >
            {player.avatar || "⚔️"}
          </Text>
        )}
      </Box>

      <Box display="flex" alignItems="center" gap={1} minW={0} lineHeight="1">
        {isTransferPending && (
          <Spinner size="xs" color="accent" />
        )}
        <Text
          fontSize="md"
          fontWeight="bold"
          color={isHost ? "highlight" : "textPrimary"}
          textShadow="0 2px 4px rgba(0,0,0,0.9)"
          fontFamily="system-ui"
          truncate
          title={`${isHost ? "ホスト: " : ""}${player.name}`}
        >
          {player.name}
        </Text>
      </Box>

      <Box
        justifySelf="end"
        alignSelf="start"
        display="inline-flex"
        alignItems="center"
        gap="1"
        px="7px"
        py="2px"
        position="relative"
        css={{
          background: `linear-gradient(135deg, ${
            statusMeta.tone === "submitted"
              ? "rgba(22, 163, 74, 0.25) 0%, rgba(21, 128, 61, 0.35) 100%"
              : statusMeta.tone === "clue-entered"
              ? "rgba(217, 119, 6, 0.25) 0%, rgba(180, 83, 9, 0.35) 100%"
              : "rgba(60, 60, 80, 0.25) 0%, rgba(40, 40, 60, 0.35) 100%"
          })`,
          border: "1px solid",
          borderColor:
            statusMeta.tone === "submitted"
              ? "rgba(34, 197, 94, 0.5)"
              : statusMeta.tone === "clue-entered"
              ? "rgba(245, 158, 11, 0.5)"
              : "rgba(100, 116, 139, 0.4)",
          borderRadius: "2px",
          clipPath:
            "polygon(4px 0%, calc(100% - 4px) 0%, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0% calc(100% - 4px), 0% 4px)",
          boxShadow:
            "0 2px 4px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 -1px 0 rgba(0, 0, 0, 0.3)",
          "&::before": {
            content: "''",
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "1px",
            background:
              statusMeta.tone === "submitted"
                ? "linear-gradient(90deg, transparent 0%, rgba(34, 197, 94, 0.8) 50%, transparent 100%)"
                : statusMeta.tone === "clue-entered"
                ? "linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.8) 50%, transparent 100%)"
                : "linear-gradient(90deg, transparent 0%, rgba(150, 160, 180, 0.6) 50%, transparent 100%)",
            pointerEvents: "none",
          },
        }}
      >
        <Box
          as="span"
          fontSize="xs"
          lineHeight="1"
          css={{
            filter:
              statusMeta.tone === "submitted"
                ? "drop-shadow(0 0 3px rgba(34, 197, 94, 0.8))"
                : statusMeta.tone === "clue-entered"
                ? "drop-shadow(0 0 3px rgba(245, 158, 11, 0.8))"
                : "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6))",
          }}
        >
          {statusMeta.icon}
        </Box>
        <Text
          fontSize="2xs"
          fontWeight="bold"
          letterSpacing="0.5px"
          textTransform="uppercase"
          css={{
            color:
              statusMeta.tone === "submitted"
                ? "#86EFAC"
                : statusMeta.tone === "clue-entered"
                ? "#FCD34D"
                : "#CBD5E1",
            textShadow:
              statusMeta.tone === "submitted"
                ? "0 0 8px rgba(34, 197, 94, 0.6), 0 1px 2px rgba(0, 0, 0, 0.8)"
                : statusMeta.tone === "clue-entered"
                ? "0 0 8px rgba(245, 158, 11, 0.6), 0 1px 2px rgba(0, 0, 0, 0.8)"
                : "0 1px 2px rgba(0, 0, 0, 0.8)",
          }}
        >
          {statusMeta.status}
        </Text>
      </Box>

      <Box gridColumn="2 / span 2" display="flex" flexDirection="column" gap="2px" minW={0}>
        <Text
          fontSize="2xs"
          color="textMuted"
          fontStyle={clueRevealed && trimmedClue ? "italic" : "normal"}
          lineHeight="1.1"
          truncate
          title={clueTitle}
        >
          {clueDisplay}
        </Text>
        <Box display="flex" alignItems="center" gap={1}>
          <Box
            flex={1}
            h="10px"
            minH="10px"
            bg="linear-gradient(180deg, rgba(5,8,15,0.98) 0%, rgba(10,15,25,0.96) 35%, rgba(18,25,38,0.94) 100%)"
            borderRadius="2px"
            overflow="hidden"
            border="1px solid"
            borderColor="rgba(80,110,150,0.35)"
            position="relative"
            maxW="148px"
            css={{
              boxShadow:
                "inset 0 2px 4px rgba(0,0,0,0.8), inset 0 -1px 2px rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.6)",
            }}
          >
            <Box
              height="100%"
              width={gaugeFillWidth}
              bg={
                isSubmitted
                  ? "linear-gradient(90deg, #16A34A 0%, #22C55E 45%, #15803D 90%)"
                  : hasClue
                  ? "linear-gradient(90deg, #D97706 0%, #F59E0B 45%, #B45309 90%)"
                  : "transparent"
              }
              transition="all 0.35s cubic-bezier(0.32, 0.94, 0.44, 1)"
              position="relative"
              css={{
                boxShadow: isSubmitted
                  ? "0 0 8px rgba(34,197,94,0.7), 0 0 16px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.3)"
                  : hasClue
                  ? "0 0 8px rgba(245,158,11,0.6), 0 0 16px rgba(245,158,11,0.3), inset 0 1px 0 rgba(255,255,255,0.25)"
                  : "none",
              }}
            />
            <Box
              position="absolute"
              top="0"
              left="0"
              right="0"
              height="40%"
              bg="linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.18) 60%, transparent 100%)"
              pointerEvents="none"
            />
            {isSubmitted && (
              <Box
                position="absolute"
                top="0"
                left="0"
                right="0"
                bottom="0"
                bg="linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)"
                css={{
                  animation: "pulse-sweep 2s ease-in-out infinite",
                  "@keyframes pulse-sweep": {
                    "0%": { transform: "translateX(-100%)" },
                    "50%": { transform: "translateX(100%)" },
                    "100%": { transform: "translateX(-100%)" },
                  },
                }}
                pointerEvents="none"
              />
            )}
            <Box
              position="absolute"
              bottom="0"
              left="0"
              right="0"
              height="2px"
              bg="linear-gradient(90deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.8) 50%, rgba(0,0,0,0.4) 100%)"
              pointerEvents="none"
            />
          </Box>

          <Box
            minW="30px"
            h="18px"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text
              fontSize="2xs"
              color="highlight"
              textShadow="0 2px 4px rgba(0,0,0,0.7)"
              fontFamily="mono"
              fontWeight="bold"
              letterSpacing="0.4px"
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

