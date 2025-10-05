"use client";
import { CARD_FLIP_EASING, HOVER_EASING } from "@/lib/ui/motion";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { memo, useEffect, useLayoutEffect, useRef } from "react";
import type { MouseEventHandler } from "react";
import { gsap } from "gsap";
import { getClueFontSize, getNumberFontSize } from "./CardText";
import styles from "./GameCard.module.css";
import { CardFaceFront, CardFaceBack } from "./CardFaces";
import { cardSizeCss } from "./cardSize";
import { useSoundEffect } from "@/lib/audio/useSoundEffect";
import { WAITING_LABEL } from "@/lib/ui/constants";

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
};

// Import the unified card system
import { BaseCard } from "../cards/BaseCard";
import {
  getDragonQuestStyleOverrides,
  getDragonQuestTextColors,
  type GameCardState
} from "../cards/card.styles";

// テキスト統一スタイル
const getUnifiedTextStyle = (): React.CSSProperties => ({
  fontFamily: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif`,
  fontWeight: 400,
  fontStyle: "normal",
  letterSpacing: "normal",
  textRendering: "optimizeLegibility",
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
});

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
}: GameCardProps) {
  // スタイル取得
  const styleOverrides = getDragonQuestStyleOverrides(state as GameCardState, waitingInCentral);
  const textColors = getDragonQuestTextColors(waitingInCentral);

  const playCardFlip = useSoundEffect("card_flip");
  const previousFlipRef = useRef<boolean>(flipped);
  const threeDContainerRef = useRef<HTMLDivElement | null>(null);
  const gsapInitialisedRef = useRef<boolean>(false);
  const flipTweenRef = useRef<gsap.core.Tween | null>(null);
  const clickHandler: MouseEventHandler<HTMLDivElement> | undefined =
    isInteractive && onClick ? onClick : undefined;
  const isResultPreset = flipPreset === "result";

  useEffect(() => {
    return () => {
      const el = threeDContainerRef.current;
      if (el) {
        gsap.killTweensOf(el);
      }
    };
  }, []);

  useEffect(() => {
    if (variant !== "flip") {
      previousFlipRef.current = flipped;
      return;
    }
    // 両方向の回転で音を鳴らす（連想→数字、数字→連想）
    if (flipped !== previousFlipRef.current) {
      playCardFlip();
    }
    previousFlipRef.current = flipped;
  }, [flipped, variant, playCardFlip]);

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
          : styleOverrides.borderColor; // Use style system for default
  const successShadow =
    state === "success"
      ? successLevel === "mild"
        ? mildGlow
        : strongGlow
      : undefined;
  const boundaryRing =
    boundary && state !== "fail" ? UI_TOKENS.SHADOWS.ringAmber : ""; // amber accent

  const mergeShadow = (core: string) =>
    boundaryRing ? `${boundaryRing}, ${core}` : core;
  // 3Dフリップカード実装
  if (variant === "flip") {
    const { effectiveMode, reducedMotion } = useAnimationSettings();
    const prefersSimple = reducedMotion || effectiveMode === "simple";

    useEffect(() => {
      return () => {
        if (flipTweenRef.current) {
          flipTweenRef.current.kill();
          flipTweenRef.current = null;
        }
      };
    }, []);

    useLayoutEffect(() => {
      const el = threeDContainerRef.current;
      if (!el) return;

      const resetTween = () => {
        if (flipTweenRef.current) {
          flipTweenRef.current.kill();
          flipTweenRef.current = null;
        }
      };

      if (prefersSimple) {
        resetTween();
        el.style.transform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";
        el.style.transition = "transform 120ms ease-out";
        return;
      }

      el.style.transition = "";

      if (!gsapInitialisedRef.current) {
        gsap.set(el, {
          rotateY: flipped ? 180 : 0,
          transformPerspective: 1000,
          transformOrigin: "center center",
        });
        gsapInitialisedRef.current = true;
      }

      resetTween();
      flipTweenRef.current = gsap.to(el, {
        duration: isResultPreset ? 0.28 : 0.35,
        rotateY: flipped ? 180 : 0,
        ease: isResultPreset ? "back.out(1.65)" : "power2.out",
        overwrite: "auto",
        transformPerspective: 1000,
        transformOrigin: "center center",
      });

      return () => {
        resetTween();
      };
    }, [flipped, isResultPreset, prefersSimple]);

    const flipTransform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";

    const backNumberFontSize = getNumberFontSize(
      typeof number === "number" ? number : null
    );

    return (
      <Box
        className={styles.root}
        bg="transparent"
        position="relative"
        style={{
          perspective: "1000px",
        }}
        width={UNIFIED_LAYOUT.CARD.WIDTH}
        height={UNIFIED_LAYOUT.CARD.HEIGHT}
        css={{
          ...cardSizeCss(),
          ...(isResultPreset
            ? {}
            : {
                "&:hover .gc3d": {
                  transform: `${flipTransform} translateY(-4px) translateZ(0)`,
                },
              }),
        }}
        minW={UNIFIED_LAYOUT.CARD.WIDTH}
        minH={UNIFIED_LAYOUT.CARD.HEIGHT}
        onClick={clickHandler}
        cursor={isInteractive ? "pointer" : undefined}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
      >
        <div
          className="gc3d"
          ref={threeDContainerRef}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transform: `${flipped ? "rotateY(180deg)" : "rotateY(0deg)"} translateZ(0)`,
            willChange: "transform",
          }}
        >
          {/* FRONT SIDE - ?????? */}
          <Box position="absolute" width="100%" height="100%" bg="transparent" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "translateZ(0)", willChange: "auto" }}>
            <CardFaceFront
              index={typeof index === "number" ? index : null}
              name={name}
              clue={clue}
              metaColor={textColors.meta}
              clueColor={textColors.clue}
              bg={styleOverrides.bg}
              border={`${styleOverrides.borderWidth} solid`}
              borderColor={successBorder}
              boxShadow={successShadow ? mergeShadow(styleOverrides.boxShadow) : styleOverrides.boxShadow}
              waitingInCentral={waitingInCentral}
            />
          </Box>

          {/* BACK SIDE - ??? */}
          <Box position="absolute" width="100%" height="100%" bg="transparent" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg) translateZ(0)", willChange: "auto" }}>
            <CardFaceBack
              index={typeof index === "number" ? index : null}
              name={name}
              number={typeof number === "number" ? number : null}
              metaColor={textColors.meta}
              numberColor={textColors.number}
              bg={styleOverrides.bg}
              border={`${styleOverrides.borderWidth} solid`}
              borderColor={successBorder}
              boxShadow={successShadow ? mergeShadow(styleOverrides.boxShadow) : styleOverrides.boxShadow}
              waitingInCentral={waitingInCentral}
            />
          </Box>
        </div>
      </Box>
    );
  }

  // フラットバリアント（2D表示）
  const baseTransform = "translateY(0) scale(1) rotateY(0deg)";
  const hoveredTransform = "translateY(-8px) scale(1.03) rotateY(0deg)";
  const hoveredBoxShadow = UI_TOKENS.SHADOWS.cardHover;

  return (
    <Box
      className={styles.root}
      width={UNIFIED_LAYOUT.CARD.WIDTH}
      height={UNIFIED_LAYOUT.CARD.HEIGHT}
      minW={UNIFIED_LAYOUT.CARD.WIDTH}
      minH={UNIFIED_LAYOUT.CARD.HEIGHT}
      css={cardSizeCss()}
      p={{ base: 3, md: "13px" }}
      borderRadius="lg"
      border={`${styleOverrides.borderWidth} solid`}
      borderColor={styleOverrides.borderColor}
      bg={styleOverrides.bg}
      color={textColors.text}
      display="grid"
      gridTemplateRows="16px minmax(0, 1fr) 16px"
      cursor="pointer"
      onClick={clickHandler}
      role={isInteractive ? "button" : undefined}
      transform={baseTransform}
      position="relative"
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
      boxShadow={styleOverrides.boxShadow}
      _hover={{
        transform: hoveredTransform,
        boxShadow: hoveredBoxShadow,
      }}
      tabIndex={0}
    >
      <Box
        fontSize="2xs"
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
          maxWidth={typeof number === "number" ? "100%" : "calc(100% - 6px)"}
          textAlign="center"
          padding={typeof number === "number" ? "0" : "0 0.2rem"}
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
        fontSize="2xs"
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

