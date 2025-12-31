"use client";
import { FLIP_DURATION_MS, HOVER_EASING } from "@/lib/ui/motion";
import { UI_TOKENS } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { memo, type MouseEventHandler } from "react";
import { getClueFontSize, getNumberFontSize } from "./CardText";
import styles from "./GameCard.module.css";
import { CardFaceFront, CardFaceBack } from "./CardFaces";
import { cardSizeCss } from "./cardSize";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { WAITING_LABEL } from "@/lib/ui/constants";
import { useCardFlipAnimation } from "./hooks/useCardFlipAnimation";

export type GameCardProps = {
  index?: number | null;
  name?: string;
  clue?: string;
  number?: number | null;
  // 'ready' is used for cards with a confirmed clue but not yet revealed
  state?: "default" | "success" | "fail" | "ready";
  successLevel?: "mild" | "final";
  boundary?: boolean;
  variant?: "flat" | "flip";
  flipped?: boolean;
  waitingInCentral?: boolean; // Dragon Quest style white borders/numbers for central waiting cards
  onClick?: MouseEventHandler<HTMLDivElement>;
  isInteractive?: boolean;
  flipPreset?: "reveal" | "result";
  dataCardId?: string;
};

import {
  getDragonQuestStyleOverrides,
  getDragonQuestTextColors,
  type GameCardState,
} from "../cards/card.styles";

const FLIP_DURATION_DEFAULT = FLIP_DURATION_MS / 1000;
const FLIP_DURATION_RESULT = Math.max(FLIP_DURATION_DEFAULT + 0.04, 0.36);
const FLIP_DURATIONS = {
  default: FLIP_DURATION_DEFAULT,
  result: FLIP_DURATION_RESULT,
} as const;
const CARD_META_FONT_SIZE = "calc(var(--chakra-fontSizes-2xs) * var(--card-text-scale))";

export function GameCard({
  index,
  name,
  clue,
  number,
  state = "default",
  successLevel,
  boundary = false,
  variant = "flat",
  flipped = false,
  waitingInCentral = true,
  onClick,
  isInteractive = false,
  flipPreset = "reveal",
  dataCardId,
}: GameCardProps) {
  // スタイル取得
  const styleOverrides = getDragonQuestStyleOverrides(state as GameCardState, waitingInCentral);
  const textColors = getDragonQuestTextColors(waitingInCentral);
  const normalizeBg = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    return "transparent";
  };
  const cardBg = normalizeBg(styleOverrides.bg);
  const resolveBorderColor = (value: unknown): string =>
    typeof value === "string" ? value : UI_TOKENS.COLORS.whiteAlpha60;
  const resolveBoxShadow = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string").join(", ");
    return UI_TOKENS.SHADOWS.cardRaised;
  };

  const playCardFlip = useSoundEffect("card_flip");
  const clickHandler: MouseEventHandler<HTMLDivElement> | undefined =
    isInteractive && onClick ? onClick : undefined;
  const isResultPreset = flipPreset === "result";

  // Shared semantic colors
  const mildGlow = UI_TOKENS.SHADOWS.ringPurpleMild;
  const strongGlow = UI_TOKENS.SHADOWS.ringPurpleStrong;
  const successBorder =
    state === "success"
      ? UI_TOKENS.COLORS.dqGold // Gold for success
      : state === "fail"
        ? UI_TOKENS.COLORS.dqRed // Red for failure
        : state === "ready"
          ? UI_TOKENS.COLORS.dqSilver // Silver for ready (with clue)
          : resolveBorderColor(styleOverrides.borderColor); // fallback to safe string
  const successShadow =
    state === "success"
      ? successLevel === "mild"
        ? mildGlow
        : strongGlow
      : undefined;
  const boundaryRing =
    boundary && state !== "fail" ? UI_TOKENS.SHADOWS.ringAmber : ""; // amber accent

  const baseShadow = resolveBoxShadow(styleOverrides.boxShadow);

  const mergeShadow = (core: string) =>
    boundaryRing ? `${boundaryRing}, ${core}` : core;

  const { effectiveMode, reducedMotion } = useAnimationSettings();
  const prefersSimple = reducedMotion || effectiveMode === "simple";
  const allow3d = variant === "flip" && !prefersSimple;
  const threeDContainerRef = useCardFlipAnimation({
    flipped,
    allow3d,
    preset: flipPreset,
    durations: FLIP_DURATIONS,
    onFlip: playCardFlip,
  });

  if (allow3d) {
    return (
      <Box
        className={styles.root}
        bg="transparent"
        position="relative"
        data-card-id={dataCardId}
        style={{
          perspective: "1000px",
          transform: "translateZ(0)",
          willChange: isResultPreset ? undefined : "transform",
        }}
        css={cardSizeCss()}
        onClick={clickHandler}
        cursor={isInteractive ? "pointer" : undefined}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        transition={isResultPreset ? undefined : `transform 0.28s ${HOVER_EASING}`}
        _hover={
          isResultPreset
            ? undefined
            : {
                transform: "translateY(-4px) translateZ(0)",
              }
        }
      >
        <div
          className="gc3d"
          ref={threeDContainerRef}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transform: "translateZ(0)",
            willChange: "transform",
          }}
        >
          {/* FRONT SIDE */}
          <Box position="absolute" width="100%" height="100%" bg="transparent" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "translateZ(0)", willChange: "auto" }}>
            <CardFaceFront
              index={typeof index === "number" ? index : null}
              name={name}
              clue={clue}
              metaColor={textColors.meta}
              clueColor={textColors.clue}
              bg={cardBg}
              border={`${styleOverrides.borderWidth} solid`}
              borderColor={successBorder}
              boxShadow={successShadow ? mergeShadow(baseShadow) : baseShadow}
              waitingInCentral={waitingInCentral}
            />
          </Box>

          {/* BACK SIDE */}
          <Box position="absolute" width="100%" height="100%" bg="transparent" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg) translateZ(0)", willChange: "auto" }}>
            <CardFaceBack
              index={typeof index === "number" ? index : null}
              name={name}
              number={typeof number === "number" ? number : null}
              metaColor={textColors.meta}
              numberColor={textColors.number}
              bg={cardBg}
              border={`${styleOverrides.borderWidth} solid`}
              borderColor={successBorder}
              boxShadow={successShadow ? mergeShadow(baseShadow) : baseShadow}
              waitingInCentral={waitingInCentral}
            />
          </Box>
        </div>
      </Box>
    );
  }
  const baseTransform = "translateY(0) scale(1) rotateY(0deg)";
  const hoveredTransform = "translateY(-8px) scale(1.03) rotateY(0deg)";
  const hoveredBoxShadow = UI_TOKENS.SHADOWS.cardHover;

  const borderColorFallback = resolveBorderColor(styleOverrides.borderColor);

  return (
    <Box
      className={styles.root}
      data-card-id={dataCardId}
      css={cardSizeCss()}
      p={{ base: 3, md: "var(--card-pad-md, 13px)" }}
      // flip状態(CardFaces)と見た目を揃える
      borderRadius="7px"
      border={`${styleOverrides.borderWidth} solid`}
      borderColor={borderColorFallback}
      bg={cardBg}
      color={textColors.text}
      display="grid"
      gridTemplateRows="16px minmax(0, 1fr) 16px"
      cursor="pointer"
      onClick={clickHandler}
      role={isInteractive ? "button" : undefined}
      transform={baseTransform}
      position="relative"
      // waiting/clue(=flat)でも枠が寂しくならないよう、CardFacesと同じ二重枠を付ける
      _before={{
        content: '""',
        position: "absolute",
        inset: "2px",
        borderRadius: "5px",
        border: "var(--card-border-width-inner) solid var(--card-border-inner)",
        borderTopColor: "var(--card-border-highlight)",
        pointerEvents: "none",
        backgroundImage: "var(--card-watermark-image)",
        backgroundPosition: "var(--card-watermark-position)",
        backgroundSize: "var(--card-watermark-size)",
        backgroundRepeat: "no-repeat",
      }}
      _after={{
        content: '""',
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: "45%",
        background: "linear-gradient(178deg, var(--card-light-moon) 0%, transparent 70%)",
        borderRadius: "6px 6px 0 0",
        pointerEvents: "none",
      }}
      style={{
        transformStyle: "preserve-3d",
        willChange: "transform",
        // GPU加速用
        transform: "translateZ(0)",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility",
      }}
      transition={`transform 0.28s ${HOVER_EASING}, box-shadow 0.28s ${HOVER_EASING}`} // AI感除去: 0.3s → 0.28s
      boxShadow={baseShadow}
      _hover={{
        transform: hoveredTransform,
        boxShadow: hoveredBoxShadow,
      }}
      tabIndex={0}
    >
      <Box
        fontSize={CARD_META_FONT_SIZE}
        lineHeight="1.3"
        fontWeight={700}
        color={textColors.meta}
        display="flex"
        alignItems="center"
      >
        <span className={styles.cardMeta}>
          #{typeof index === "number" ? index + 1 : "?"}
        </span>
      </Box>
      <Box position="relative" overflow="visible" minHeight="0">
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          fontWeight={700}
          fontSize={
            typeof number === "number"
              ? getNumberFontSize(number)
              : getClueFontSize(clue)
          }
          color={UI_TOKENS.COLORS.textBase}
          lineHeight={typeof number === "number" ? 1.3 : 1.3}
          textShadow={
            waitingInCentral
              ? UI_TOKENS.TEXT_SHADOWS.none // Clean white text without shadow for waiting cards
              : typeof number === "number"
                ? UI_TOKENS.TEXT_SHADOWS.soft
                : UI_TOKENS.TEXT_SHADOWS.none
          }
          width="100%"
          maxWidth={
            typeof number === "number"
              ? "100%"
              : "calc(100% - (6px * var(--card-text-scale)))"
          }
          textAlign="center"
          padding={
            typeof number === "number"
              ? "0"
              : "0 calc(0.2rem * var(--card-text-scale))"
          }
          wordBreak={
            typeof number === "number" ? "keep-all" : clue === WAITING_LABEL ? "keep-all" : "break-word"
          }
          whiteSpace={
            typeof number === "number" ? "nowrap" : clue === WAITING_LABEL ? "nowrap" : "normal"
          }
          overflowWrap={typeof number === "number" ? "normal" : "anywhere"}
          overflow="visible"
          display={typeof number === "number" ? "block" : "flex"}
          maxHeight={typeof number === "number" ? "1.6em" : undefined}
          alignItems={typeof number === "number" ? undefined : "center"}
          justifyContent={typeof number === "number" ? undefined : "center"}
          letterSpacing={
            typeof number === "number"
              ? String(number).length >= 3
                ? "-0.8px"
                : "-0.3px"
              : undefined
          }
          style={{
            wordWrap: typeof number === "number" ? "normal" : "break-word",
            hyphens: typeof number === "number" ? "none" : "auto",
            // アンチエイリアス
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
          }}
          css={
            typeof number === "number"
              ? {
                  // 数字用スタイル
                  width: "100%",
                  minWidth: "0",
                  maxWidth: "100%",
                  fontVariantNumeric: "normal",
                  fontFamily: "inherit",
                  "& > *": {
                    width: "100%",
                    minWidth: "0",
                    fontVariantNumeric: "normal",
                  },
                }
              : undefined
          }
        >
          {typeof number === "number" ? (
            <span
              style={{
                display: "block",
                width: "100%",
                textAlign: "center",
                fontVariantNumeric: "normal",
                whiteSpace: "nowrap",
              }}
            >
              {number}
            </span>
          ) : (
            clue || "?"
          )}
        </Box>
      </Box>
      <Box
        fontSize={CARD_META_FONT_SIZE}
        lineHeight="1.3"
        fontWeight={700}
        color={textColors.meta}
        display="flex"
        alignItems="center"
        justifyContent="flex-start"
        textAlign="left"
      >
        <span className={styles.cardMeta}>{name ?? "(??)"}</span>
      </Box>
    </Box>
  );
}

// パフォーマンス最適化（再レンダリング防止）
export default memo(GameCard, (prev, next) => {
  if (prev.index !== next.index) return false;
  if (prev.name !== next.name) return false;
  if (prev.clue !== next.clue) return false;
  if (prev.number !== next.number) return false;
  if (prev.state !== next.state) return false;
  if (prev.successLevel !== next.successLevel) return false;
  if (prev.boundary !== next.boundary) return false;
  if (prev.variant !== next.variant) return false;
  if (prev.flipped !== next.flipped) return false;
  if (prev.waitingInCentral !== next.waitingInCentral) return false;
  if (prev.isInteractive !== next.isInteractive) return false;
  if (prev.flipPreset !== next.flipPreset) return false;

  return true;
});

