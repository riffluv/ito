"use client";
import { CARD_FLIP_EASING, HOVER_EASING } from "@/lib/ui/motion";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import { useAnimationSettings } from "@/lib/animation/AnimationContext";
import { memo, useRef } from "react";
import { getClueFontSize, getNumberFontSize } from "./CardText";
import styles from "./GameCard.module.css";

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

// ドラクエ風統一デザインシステム - メインメニューとの一体感
const getDragonQuestStyle = (waitingInCentral: boolean, state: string) => {
  // ベース色設定（メインメニューと統一）
  const baseColors = {
    bg: waitingInCentral ? "#1a1d23" : "#0f0f23", // 深い青黒
    border: waitingInCentral
      ? UI_TOKENS.COLORS.whiteAlpha80
      : UI_TOKENS.COLORS.whiteAlpha60,
    text: UI_TOKENS.COLORS.textBase,
    meta: waitingInCentral ? UI_TOKENS.COLORS.whiteAlpha90 : UI_TOKENS.COLORS.textMuted,
  };

  // 状態別アクセント
  const stateAccent = {
    success: UI_TOKENS.COLORS.dqBlue, // ドラクエ風の青
    fail: UI_TOKENS.COLORS.dqRed, // 控えめな赤
    default: baseColors.border,
  };

  // ドラクエ風の重厚なボーダー（メインメニューと統一）
  const borderStyle = waitingInCentral
    ? "2px solid" // 中央では少し太め
    : "1px solid"; // 通常時は細め

  // メインメニューレベルの豪華なドラクエ風シャドウ（トークン化）
  const boxShadow = waitingInCentral
    ? UI_TOKENS.SHADOWS.panelDistinct
    : state === "success" || state === "ready"
    ? UI_TOKENS.SHADOWS.cardFloating
    : UI_TOKENS.SHADOWS.cardRaised;

  return {
    bg: baseColors.bg,
    border: borderStyle,
    borderColor:
      state === "success"
        ? UI_TOKENS.COLORS.dqBlue // 成功時は青
        : state === "fail"
          ? UI_TOKENS.COLORS.dqRed // 失敗時は赤
          : state === "ready"
            ? UI_TOKENS.COLORS.purpleAlpha80 // 連想ワード登録完了時は紫ボーダー
            : stateAccent.default, // その他はデフォルト（白）
    boxShadow,
    colors: {
      text: baseColors.text,
      meta: baseColors.meta,
      clue: waitingInCentral ? UI_TOKENS.COLORS.textBase : "#e2e8f0",
      number: UI_TOKENS.COLORS.textBase, // 全状態で白色統一 - 視認性最優先
    },
  };
};

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
  const dragonQuestStyle = getDragonQuestStyle(waitingInCentral, state);

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
    const { effectiveMode } = useAnimationSettings();
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
          width={UNIFIED_LAYOUT.CARD.WIDTH}
          height={UNIFIED_LAYOUT.CARD.HEIGHT}
          minW={UNIFIED_LAYOUT.CARD.WIDTH}
          minH={UNIFIED_LAYOUT.CARD.HEIGHT}
          css={{
            width: "100px",
            height: "140px",
            minWidth: "100px",
            minHeight: "140px",
            "@media (min-width: 768px)": {
              width: "120px",
              height: "168px",
              minWidth: "120px",
              minHeight: "168px",
            },
            "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
              {
                width: "95px",
                height: "133px",
                minWidth: "95px",
                minHeight: "133px",
              },
            "@media (min-resolution: 1.25dppx) and (min-width: 768px), screen and (-webkit-device-pixel-ratio: 1.25) and (min-width: 768px)":
              {
                width: "114px",
                height: "160px",
                minWidth: "114px",
                minHeight: "160px",
              },
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
              width: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.base,
              height: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.base,
              minWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.base,
              minHeight: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.base,
            },
            [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150} and (min-width: 768px)`]: {
              width: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.md,
              height: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.md,
              minWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.md,
              minHeight: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.md,
            },
          }}
          p={{ base: 3, md: "13px" }}
          borderRadius="lg"
          border={dragonQuestStyle.border}
          borderColor={dragonQuestStyle.borderColor}
          bg={dragonQuestStyle.bg}
          color={dragonQuestStyle.colors.text}
          boxShadow={dragonQuestStyle.boxShadow}
        >
          <Box position="relative" width="100%" height="100%">
            {/* FRONT LAYER */}
            <Box
              aria-hidden={flipped}
              position="absolute"
              inset={0}
              p={{ base: 0, md: 0 }}
              style={{
                opacity: flipped ? 0 : 1,
                transition: `opacity 0.2s ${UI_TOKENS.EASING.standard}`,
              }}
              display="grid"
              gridTemplateRows="16px minmax(0,1fr) 16px"
            >
              <Box
                fontSize="2xs"
                lineHeight="1.3"
                color={dragonQuestStyle.colors.meta}
                style={getUnifiedTextStyle()}
                display="flex"
                alignItems="center"
              >
                <span className={styles.cardMeta}>
                  #{typeof index === "number" ? index + 1 : "?"}
                </span>
              </Box>
              <Box position="relative" minHeight={0}>
                <Box
                  position="absolute"
                  top="50%"
                  left="50%"
                  transform="translate(-50%, -50%)"
                  fontWeight={700}
                  fontSize={getClueFontSize(clue)}
                  color={dragonQuestStyle.colors.clue}
                  lineHeight="1.3"
                  width="100%"
                  maxWidth="calc(100% - 6px)"
                  textAlign="center"
                  padding="0 0.2rem"
                  wordBreak={clue === "Waiting" ? "keep-all" : "break-word"}
                  whiteSpace={clue === "Waiting" ? "nowrap" : "normal"}
                  overflowWrap="anywhere"
                >
                  {clue || "(連想なし)"}
                </Box>
              </Box>
              <Box
                fontSize="2xs"
                lineHeight="1.3"
                color={dragonQuestStyle.colors.meta}
                textAlign="left"
                style={getUnifiedTextStyle()}
              >
                <span className={styles.cardMeta}>{name ?? "(不明)"}</span>
              </Box>
            </Box>

            {/* BACK LAYER */}
            <Box
              aria-hidden={!flipped}
              position="absolute"
              inset={0}
              p={{ base: 0, md: 0 }}
              style={{
                opacity: flipped ? 1 : 0,
                transition: `opacity 0.2s ${UI_TOKENS.EASING.standard}`,
              }}
              display="grid"
              gridTemplateRows="16px minmax(0,1fr) 16px"
            >
              <Box
                fontSize="2xs"
                lineHeight="1.3"
                color={dragonQuestStyle.colors.meta}
                style={getUnifiedTextStyle()}
                display="flex"
                alignItems="center"
              >
                <span className={styles.cardMeta}>
                  #{typeof index === "number" ? index + 1 : "?"}
                </span>
              </Box>
              <Box position="relative" minHeight={0}>
                <Box
                  position="absolute"
                  top="50%"
                  left="50%"
                  transform="translate(-50%, -50%)"
                  fontWeight={700}
                  fontSize={backNumberFontSize}
                  color={dragonQuestStyle.colors.number}
                  lineHeight={1.3}
                  width="100%"
                  textAlign="center"
                >
                  {typeof number === "number" ? number : "?"}
                </Box>
              </Box>
              <Box
                fontSize="2xs"
                lineHeight="1.3"
                color={dragonQuestStyle.colors.meta}
                textAlign="left"
                style={getUnifiedTextStyle()}
              >
                <span className={styles.cardMeta}>{name ?? "(不明)"}</span>
              </Box>
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
          // DPI 100%ベース設計（標準）
          width: "100px",
          height: "140px",
          minWidth: "100px",
          minHeight: "140px",
          "@media (min-width: 768px)": {
            width: "120px",
            height: "168px",
            minWidth: "120px",
            minHeight: "168px",
          },
          // DPI 125%：軽微な縮小でバランス維持
          "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
            {
              width: "95px",
              height: "133px",
              minWidth: "95px",
              minHeight: "133px",
            },
          "@media (min-resolution: 1.25dppx) and (min-width: 768px), screen and (-webkit-device-pixel-ratio: 1.25) and (min-width: 768px)":
            {
              width: "114px",
              height: "160px",
              minWidth: "114px",
              minHeight: "160px",
            },
          // DPI 150%：統一定数活用でレイアウト収束
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
            width: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.base,
            height: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.base,
            minWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.base,
            minHeight: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.base,
          },
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150} and (min-width: 768px)`]: {
            width: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.md,
            height: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.md,
            minWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.md,
            minHeight: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.md,
          },
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
            transition: `transform 0.6s ${CARD_FLIP_EASING}`,
          }}
        >
          {/* FRONT SIDE - 連想ワード面 */}
          <Box
            position="absolute"
            width="100%"
            height="100%"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              // フォント描画改善: レイヤー促進
              transform: "translateZ(0)",
              willChange: "auto",
            }}
            p={{ base: 3, md: "13px" }}
            borderRadius="lg"
            border={dragonQuestStyle.border}
            borderColor={successBorder}
            bg={dragonQuestStyle.bg}
            color={dragonQuestStyle.colors.text}
            display="grid"
            gridTemplateRows="16px 1fr 16px"
            alignItems="stretch"
            boxShadow={
              successShadow
                ? mergeShadow(dragonQuestStyle.boxShadow)
                : dragonQuestStyle.boxShadow
            }
            transition="background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease"
          >
            <Box
              fontSize="2xs"
              lineHeight="1.3" // ディセンダー対応
              style={getUnifiedTextStyle()}
              color={dragonQuestStyle.colors.meta}
              display="flex"
              alignItems="center"
            >
              <span className={styles.cardMeta}>
                #{typeof index === "number" ? index + 1 : "?"}
              </span>
            </Box>
            <Box position="relative">
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                fontWeight={700}
                fontSize={getClueFontSize(clue)}
                color={dragonQuestStyle.colors.clue}
                lineHeight="1.3" // ディセンダー対応
                width="100%"
                maxWidth="calc(100% - 6px)"
                textAlign="center"
                padding="0 0.2rem"
                wordBreak={clue === "Waiting" ? "keep-all" : "break-word"}
                whiteSpace={clue === "Waiting" ? "nowrap" : "normal"}
                overflowWrap="anywhere"
                overflow="visible"
                display="flex"
                alignItems="center"
                justifyContent="center"
                style={{
                  textShadow: waitingInCentral
                    ? UI_TOKENS.TEXT_SHADOWS.none
                    : UI_TOKENS.TEXT_SHADOWS.soft,
                  wordWrap: "break-word",
                  hyphens: "auto",
                  WebkitFontSmoothing: "antialiased",
                  MozOsxFontSmoothing: "grayscale",
                }}
              >
                {clue || "(連想なし)"}
              </Box>
            </Box>
            <Box
              fontSize="2xs"
              lineHeight="1.3" // ディセンダー対応
              style={getUnifiedTextStyle()}
              color={dragonQuestStyle.colors.meta}
              display="flex"
              alignItems="center"
              justifyContent="flex-start"
              textAlign="left"
            >
              <span className={styles.cardMeta}>{name ?? "(不明)"}</span>
            </Box>
          </Box>

          {/* BACK SIDE - 数字面 */}
          <Box
            position="absolute"
            width="100%"
            height="100%"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg) translateZ(0)",
              willChange: "auto",
            }}
            p={{ base: 3, md: "13px" }}
            borderRadius="lg"
            border={dragonQuestStyle.border}
            borderColor={successBorder}
            bg={dragonQuestStyle.bg}
            boxShadow={
              successShadow
                ? mergeShadow(dragonQuestStyle.boxShadow)
                : dragonQuestStyle.boxShadow
            }
            color={dragonQuestStyle.colors.text}
            display="grid"
            gridTemplateRows="16px 1fr 16px"
            transition="background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease"
          >
            <Box
              fontSize="2xs"
              lineHeight="1.3" // ディセンダー対応
              style={getUnifiedTextStyle()}
              color={dragonQuestStyle.colors.meta}
              display="flex"
              alignItems="center"
            >
              <span className={styles.cardMeta}>
                #{typeof index === "number" ? index + 1 : "?"}
              </span>
            </Box>
            <Box position="relative">
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                fontWeight={700}
                fontSize={backNumberFontSize}
                color={UI_TOKENS.COLORS.textBase} // 全状態で白色統一
                lineHeight="1.3" // ディセンダー対応
                textShadow={
                  waitingInCentral ? UI_TOKENS.TEXT_SHADOWS.none : UI_TOKENS.TEXT_SHADOWS.soft
                }
                width="100%"
                textAlign="center"
                whiteSpace="nowrap"
                letterSpacing={
                  typeof number === "number" && String(number).length >= 3
                    ? "-0.8px" // flipカードでも同じ適切な文字間隔
                    : undefined
                }
              >
                {typeof number === "number" ? number : ""}
              </Box>
            </Box>
            <Box
              fontSize="2xs"
              lineHeight="1.3" // ディセンダー対応
              style={getUnifiedTextStyle()}
              color={dragonQuestStyle.colors.meta}
              display="flex"
              alignItems="center"
              justifyContent="flex-start"
              textAlign="left"
            >
              <span className={styles.cardMeta}>{name ?? "(不明)"}</span>
            </Box>
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
      css={{
        // DPI 100%ベース設計（標準）
        width: "100px",
        height: "140px",
        minWidth: "100px",
        minHeight: "140px",
        "@media (min-width: 768px)": {
          width: "120px",
          height: "168px",
          minWidth: "120px",
          minHeight: "168px",
        },
        // DPI 125%：軽微な縮小でバランス維持
        "@media (min-resolution: 1.25dppx), screen and (-webkit-device-pixel-ratio: 1.25)":
          {
            width: "95px",
            height: "133px",
            minWidth: "95px",
            minHeight: "133px",
          },
        "@media (min-resolution: 1.25dppx) and (min-width: 768px), screen and (-webkit-device-pixel-ratio: 1.25) and (min-width: 768px)":
          {
            width: "114px",
            height: "160px",
            minWidth: "114px",
            minHeight: "160px",
          },
        // DPI 150%：統一定数活用でレイアウト収束
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: {
          width: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.base,
          height: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.base,
          minWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.base,
          minHeight: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.base,
        },
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150} and (min-width: 768px)`]: {
          width: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.md,
          height: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.md,
          minWidth: UNIFIED_LAYOUT.DPI_150.CARD.WIDTH.md,
          minHeight: UNIFIED_LAYOUT.DPI_150.CARD.HEIGHT.md,
        },
      }}
      p={{ base: 3, md: "13px" }}
      borderRadius="lg"
      border={dragonQuestStyle.border}
      borderColor={dragonQuestStyle.borderColor}
      bg={dragonQuestStyle.bg}
      color={dragonQuestStyle.colors.text}
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
      boxShadow={dragonQuestStyle.boxShadow}
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
        color={dragonQuestStyle.colors.meta}
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
            typeof number === "number"
              ? "keep-all"
              : clue === "Waiting"
                ? "keep-all"
                : "break-word"
          }
          whiteSpace={
            typeof number === "number"
              ? "nowrap"
              : clue === "Waiting"
                ? "nowrap"
                : "normal"
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
        color={dragonQuestStyle.colors.meta}
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
