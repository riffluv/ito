"use client";
import { CARD_FLIP_EASING, HOVER_EASING } from "@/lib/ui/motion";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { memo, useRef } from "react";
import { getClueFontSize, getNumberFontSize } from "./CardText";
import styles from "./GameCard.module.css";
import { CardFaceFront, CardFaceBack } from "./CardFaces";
import { cardSizeCss } from "./cardSize";
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
};

// Import the unified card system
import { BaseCard } from "../cards/BaseCard";
import {
  getDragonQuestStyleOverrides,
  getDragonQuestTextColors,
  type GameCardState
} from "../cards/card.styles";

// 🎯 統一されたテキストスタイル関数（CSS ベストプラクティス）
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
}: GameCardProps) {
  // hoverはCSS擬似クラスで処理し、再レンダーを避ける

  // ドラクエ風統一デザイン取得
  // 🎯 統一されたドラクエ風スタイルシステム使用
  const styleOverrides = getDragonQuestStyleOverrides(state as GameCardState, waitingInCentral);
  const textColors = getDragonQuestTextColors(waitingInCentral);

  // Shared semantic colors
  const mildGlow = UI_TOKENS.SHADOWS.ringPurpleMild;
  const strongGlow = UI_TOKENS.SHADOWS.ringPurpleStrong;
  const successBorder =
    state === "success"
      ? UI_TOKENS.COLORS.dqBlue // Blue for success  
      : state === "fail"
        ? UI_TOKENS.COLORS.dqRed // Red for failure
        : state === "ready"
          ? UI_TOKENS.COLORS.purpleAlpha80 // Purple for ready (with clue)
          : UI_TOKENS.COLORS.textBase; // White for default/pending
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
  // 3D FLIP CARD IMPLEMENTATION - 以前の動作していたバージョンを復活
  if (variant === "flip") {
    const { effectiveMode, reducedMotion } = useAnimationSettings();
    // 初回レンダー時のモードを固定し、途中切替（auto判定の反映）によるDOM差し替えを防ぐ
    const stableModeRef = useRef<"3d" | "simple">(effectiveMode);
    const stableMode = stableModeRef.current;
    if (stableMode === "simple") {
      // 低スペック向け: クロスフェードで“めくった感”を演出（回転なし）
      const backNumberFontSize = getNumberFontSize(
        typeof number === "number" ? number : null
      );
      return (
        <Box
          className={styles.root}
          width={UNIFIED_LAYOUT.CARD.WIDTH}
          height={UNIFIED_LAYOUT.CARD.HEIGHT}
          minW={UNIFIED_LAYOUT.CARD.WIDTH}
          minH={UNIFIED_LAYOUT.CARD.HEIGHT}
          css={cardSizeCss()}
          p={0}
          borderRadius="8px"
          border="none"
          bg="transparent"
          color={textColors.text}
        >
          <Box position="relative" width="100%" height="100%">
            {/* FRONT LAYER */}
            <Box aria-hidden={flipped} position="absolute" inset={0} p={{ base: 0, md: 0 }}
              style={{ opacity: flipped ? 0 : 1, transition: `opacity ${reducedMotion ? 10 : 200}ms ${UI_TOKENS.EASING.standard}` }}>
              <CardFaceFront
                index={typeof index === "number" ? index : null}
                name={name}
                clue={clue}
                metaColor={textColors.meta}
                clueColor={textColors.clue}
                bg={styleOverrides.bg}
                border={`${styleOverrides.borderWidth} solid`}
                borderColor={successBorder}
                boxShadow={
                  successShadow
                    ? mergeShadow(styleOverrides.boxShadow)
                    : styleOverrides.boxShadow
                }
                waitingInCentral={waitingInCentral}
              />
            </Box>

            {/* BACK LAYER */}
            <Box aria-hidden={!flipped} position="absolute" inset={0} p={{ base: 0, md: 0 }}
              style={{ opacity: flipped ? 1 : 0, transition: `opacity ${reducedMotion ? 10 : 200}ms ${UI_TOKENS.EASING.standard}` }}>
              <CardFaceBack
                index={typeof index === "number" ? index : null}
                name={name}
                number={typeof number === "number" ? number : null}
                metaColor={textColors.meta}
                numberColor={textColors.number}
                bg={styleOverrides.bg}
                border={`${styleOverrides.borderWidth} solid`}
                borderColor={successBorder}
                boxShadow={
                  successShadow
                    ? mergeShadow(styleOverrides.boxShadow)
                    : styleOverrides.boxShadow
                }
                waitingInCentral={waitingInCentral}
              />
            </Box>
          </Box>
        </Box>
      );
    }
    // 3Dモード（従来）
    const flipTransform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";

    const backNumberFontSize = getNumberFontSize(
      typeof number === "number" ? number : null
    );

    return (
      <Box
        className={styles.root}
        style={{
          perspective: "1000px",
        }}
        width={UNIFIED_LAYOUT.CARD.WIDTH}
        height={UNIFIED_LAYOUT.CARD.HEIGHT}
        css={{
          ...cardSizeCss(),
          // ホバー時は3D要素にわずかなY移動を加える（transformの競合を避けて親から指定）
          "&:hover .gc3d": {
            transform: `${flipTransform} translateY(-4px) translateZ(0)`,
          },
        }}
        minW={UNIFIED_LAYOUT.CARD.WIDTH}
        minH={UNIFIED_LAYOUT.CARD.HEIGHT}
      >
        <div
          className="gc3d"
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transform: `${flipped ? "rotateY(180deg)" : "rotateY(0deg)"} translateZ(0)`,
            willChange: "transform",
            transition: `transform ${reducedMotion ? 10 : 600}ms ${CARD_FLIP_EASING}`,
          }}
        >
          {/* FRONT SIDE - 連想ワード面 */}
          <Box position="absolute" width="100%" height="100%" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "translateZ(0)", willChange: "auto" }}>
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

          {/* BACK SIDE - 数字面 */}
          <Box position="absolute" width="100%" height="100%" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg) translateZ(0)", willChange: "auto" }}>
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

  // FLAT VARIANT - 通常のカード表示（CSSホバーで再レンダー無し）
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
      transform={baseTransform}
      style={{
        transformStyle: "preserve-3d",
        willChange: "transform",
        // フォント描画改善: レイヤー促進（判定ボタン押下時と同等の描画品質を常時適用）
        transform: "translateZ(0)",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility",
      }}
      transition={`transform 0.3s ${HOVER_EASING}, box-shadow 0.3s ${HOVER_EASING}`}
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
              : getClueFontSize(clue) // 連想ワード用の動的フォントサイズ
          }
          color={UI_TOKENS.COLORS.textBase} // 全状態で白色統一
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
                ? "-0.8px" // 3桁数字の適切な文字間隔
                : "-0.3px" // 2桁数字の適切な文字間隔
              : undefined
          }
          style={{
            wordWrap: typeof number === "number" ? "normal" : "break-word",
            hyphens: typeof number === "number" ? "none" : "auto",
            // フォント描画の統一のみ適用（transformは除外）
            WebkitFontSmoothing: "antialiased",
            MozOsxFontSmoothing: "grayscale",
          }}
          css={
            typeof number === "number"
              ? {
                  // CSS詳細度を上げて適切に上書き
                  width: "100%",
                  minWidth: "0",
                  maxWidth: "100%",
                  fontVariantNumeric: "normal",
                  fontFamily: "inherit",
                  // ネストした子要素も制御
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
        <span className={styles.cardMeta}>{name ?? "(不明)"}</span>
      </Box>
    </Box>
  );
}

export default memo(GameCard);
