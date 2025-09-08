"use client";
import { CARD_FLIP_EASING, HOVER_EASING } from "@/lib/ui/motion";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import { useState } from "react";
import { getClueFontSize, getNumberFontSize } from "./CardText";
import styles from "./GameCard.module.css";

export type GameCardProps = {
  index?: number | null;
  name?: string;
  clue?: string;
  number?: number | null;
  state?: "default" | "success" | "fail";
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
      ? "rgba(255,255,255,0.8)"
      : "rgba(255,255,255,0.6)",
    text: "#ffffff",
    meta: waitingInCentral ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.7)",
  };

  // 状態別アクセント
  const stateAccent = {
    success: "#4a9eff", // ドラクエ風の青
    fail: "#ff6b6b", // 控えめな赤
    default: baseColors.border,
  };

  // ドラクエ風の重厚なボーダー（メインメニューと統一）
  const borderStyle = waitingInCentral
    ? "2px solid" // 中央では少し太め
    : "1px solid"; // 通常時は細め

  // メインメニューレベルの豪華なドラクエ風シャドウ
  const boxShadow = waitingInCentral
    ? "0 8px 32px -8px rgba(0,0,0,0.3), 0 4px 16px -4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 2px 0 rgba(255,255,255,0.06)"
    : state === "success"
      ? "0 8px 24px -8px rgba(74,158,255,0.4), 0 4px 12px -4px rgba(74,158,255,0.3), inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 1px rgba(74,158,255,0.2)"
      : state === "fail"
        ? "0 8px 24px -8px rgba(255,107,107,0.4), 0 4px 12px -4px rgba(255,107,107,0.3), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,107,107,0.2)"
        : "0 4px 16px -4px rgba(0,0,0,0.25), 0 2px 8px -2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)";

  return {
    bg: baseColors.bg,
    border: borderStyle,
    borderColor:
      state === "success"
        ? "rgba(34, 197, 94, 0.8)" // 成功時は緑ボーダーで演出
        : stateAccent[state as keyof typeof stateAccent] || stateAccent.default,
    boxShadow,
    colors: {
      text: baseColors.text,
      meta: baseColors.meta,
      clue: waitingInCentral ? "#ffffff" : "#e2e8f0",
      number: "#ffffff", // 全状態で白色統一 - 視認性最優先
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
  const [isHovered, setIsHovered] = useState(false);

  // ドラクエ風統一デザイン取得
  const dragonQuestStyle = getDragonQuestStyle(waitingInCentral, state);

  // Shared semantic colors
  const successStrong = "#22c55e";
  const mildGlow = "0 0 0 2px rgba(34,197,94,0.18)";
  const strongGlow = "0 0 0 3px rgba(34,197,94,0.35)";
  const successBorder =
    state === "success"
      ? "#3b82f6" // Blue for success
      : state === "fail"
        ? "#dc2626" // Red for failure
        : "#ffffff"; // White for default/pending
  const successShadow =
    state === "success"
      ? successLevel === "mild"
        ? mildGlow
        : strongGlow
      : undefined;
  const boundaryRing =
    boundary && state !== "fail" ? "0 0 0 1px rgba(217,119,6,0.65)" : ""; // amber accent

  const mergeShadow = (core: string) =>
    boundaryRing ? `${boundaryRing}, ${core}` : core;
  // 3D FLIP CARD IMPLEMENTATION - 以前の動作していたバージョンを復活
  if (variant === "flip") {
    // アニメーション競合を防ぐため、フリップ中はホバー効果を無効化
    const hoverTransform = (isHovered && !flipped) ? "translateY(-4px)" : "translateY(0)";
    const flipTransform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";

    const backNumberFontSize = getNumberFontSize(
      typeof number === "number" ? number : null
    );

    return (
      <Box
        style={{
          perspective: "1000px",
        }}
        width={UNIFIED_LAYOUT.CARD.WIDTH}
        height={UNIFIED_LAYOUT.CARD.HEIGHT}
        css={{
          // 基本サイズ
          width: "100px",
          height: "140px",
          minWidth: "100px",
          minHeight: "140px",
          "@media (min-width: 768px)": {
            width: "120px",
            height: "168px",
            minWidth: "120px",
            minHeight: "168px"
          },
          // DPI 150%対応：カードサイズ統一
          "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)": {
            width: "88px !important",
            height: "123px !important",
            minWidth: "88px !important",
            minHeight: "123px !important",
          },
          "@media (min-resolution: 1.5dppx) and (min-width: 768px), screen and (-webkit-device-pixel-ratio: 1.5) and (min-width: 768px)": {
            width: "105px !important",
            height: "147px !important",
            minWidth: "105px !important",
            minHeight: "147px !important",
          },
        }}
        minW={UNIFIED_LAYOUT.CARD.WIDTH}
        minH={UNIFIED_LAYOUT.CARD.HEIGHT}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transform: `${flipTransform} ${hoverTransform} translateZ(0)`,
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
            borderColor={dragonQuestStyle.borderColor}
            bg={dragonQuestStyle.bg}
            color={dragonQuestStyle.colors.text}
            display="grid"
            gridTemplateRows="16px 1fr 16px"
            alignItems="stretch"
            boxShadow={dragonQuestStyle.boxShadow}
            transition="all 0.3s ease"
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
                maxWidth="calc(100% - 8px)"
                textAlign="center"
                padding="0 0.25rem"
                wordBreak="break-word"
                whiteSpace="normal"
                overflowWrap="anywhere"
                overflow="visible"
                display="flex"
                alignItems="center"
                justifyContent="center"
                style={{
                  textShadow: waitingInCentral
                    ? "none"
                    : "0 1px 2px rgba(0,0,0,0.5)",
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
            borderColor={dragonQuestStyle.borderColor}
            bg={dragonQuestStyle.bg}
            boxShadow={dragonQuestStyle.boxShadow}
            color={dragonQuestStyle.colors.text}
            display="grid"
            gridTemplateRows="16px 1fr 16px"
            transition="all 0.3s ease"
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
                color="#ffffff" // 全状態で白色統一
                lineHeight="1.3" // ディセンダー対応
                textShadow={
                  waitingInCentral ? "none" : "0 1px 2px rgba(0,0,0,0.5)"
                }
                width="100%"
                textAlign="center"
                whiteSpace="nowrap"
                letterSpacing={
                  typeof number === "number" && String(number).length >= 3
                    ? "-0.8px"  // flipカードでも同じ適切な文字間隔
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

  // FLAT VARIANT - 通常のカード表示（メインメニューレベルのホバー効果）
  const hoverTransform = isHovered
    ? "translateY(-8px) scale(1.03) rotateY(0deg)"
    : "translateY(0) scale(1) rotateY(0deg)";
  
  const hoverBoxShadow = isHovered && dragonQuestStyle.boxShadow
    ? dragonQuestStyle.boxShadow.replace(/rgba\(0,0,0,0\.25\)/g, "rgba(0,0,0,0.4)")
                                    .replace(/rgba\(0,0,0,0\.15\)/g, "rgba(0,0,0,0.25)")
                                    .replace(/rgba\(74,158,255,0\.4\)/g, "rgba(74,158,255,0.6)")
                                    .replace(/rgba\(255,107,107,0\.4\)/g, "rgba(255,107,107,0.6)")
    : dragonQuestStyle.boxShadow;

  return (
    <Box
      width={UNIFIED_LAYOUT.CARD.WIDTH}
      height={UNIFIED_LAYOUT.CARD.HEIGHT}
      minW={UNIFIED_LAYOUT.CARD.WIDTH}
      minH={UNIFIED_LAYOUT.CARD.HEIGHT}
      css={{
        // 基本サイズ
        width: "100px",
        height: "140px",
        minWidth: "100px",
        minHeight: "140px",
        "@media (min-width: 768px)": {
          width: "120px",
          height: "168px",
          minWidth: "120px",
          minHeight: "168px"
        },
        // DPI 150%対応：カードサイズ統一
        "@media (min-resolution: 1.5dppx), screen and (-webkit-device-pixel-ratio: 1.5)": {
          width: "88px !important",
          height: "123px !important",
          minWidth: "88px !important",
          minHeight: "123px !important",
        },
        "@media (min-resolution: 1.5dppx) and (min-width: 768px), screen and (-webkit-device-pixel-ratio: 1.5) and (min-width: 768px)": {
          width: "105px !important",
          height: "147px !important",
          minWidth: "105px !important",
          minHeight: "147px !important",
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
      transform={hoverTransform}
      style={{ 
        transformStyle: "preserve-3d", 
        willChange: "transform",
        // フォント描画改善: レイヤー促進（判定ボタン押下時と同等の描画品質を常時適用）
        transform: "translateZ(0)",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility"
      }}
      transition={`all 0.3s ${HOVER_EASING}`}
      boxShadow={hoverBoxShadow}
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
          color="#ffffff" // 全状態で白色統一
          lineHeight={typeof number === "number" ? 1.3 : 1.3}
          textShadow={
            waitingInCentral
              ? "none" // Clean white text without shadow for waiting cards
              : typeof number === "number"
                ? "0 1px 2px rgba(0,0,0,0.5)"
                : "none"
          }
          width="100%"
          maxWidth={typeof number === "number" ? "100%" : "calc(100% - 8px)"}
          textAlign="center"
          padding={typeof number === "number" ? "0" : "0 0.25rem"}
          wordBreak={typeof number === "number" ? "keep-all" : "break-word"}
          whiteSpace={typeof number === "number" ? "nowrap" : "normal"}
          overflowWrap={typeof number === "number" ? "normal" : "anywhere"}
          overflow="visible"
          display={typeof number === "number" ? "block" : "flex"}
          maxHeight={typeof number === "number" ? "1.6em" : undefined}
          alignItems={typeof number === "number" ? undefined : "center"}
          justifyContent={typeof number === "number" ? undefined : "center"}
          letterSpacing={
            typeof number === "number"
              ? String(number).length >= 3 
                ? "-0.8px"  // 3桁数字の適切な文字間隔
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
          css={typeof number === "number" ? {
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
              fontVariantNumeric: "normal"
            }
          } : undefined}
        >
          {typeof number === "number" ? (
            <span style={{
              display: "block",
              width: "100%",
              textAlign: "center",
              fontVariantNumeric: "normal",
              whiteSpace: "nowrap"
            }}>
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

export default GameCard;
