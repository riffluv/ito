"use client";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Text, useSlotRecipe } from "@chakra-ui/react";
import { CARD_FLIP_EASING, HOVER_EASING } from "@/lib/ui/motion";
import React, { useState } from "react";
// LEGACY PREMIUM: premiumGameStyles 削除済み - 旧ファクションカラーシステムは無効化

export type GameCardProps = {
  index?: number | null;
  name?: string;
  clue?: string;
  number?: number | null;
  state?: "default" | "success" | "fail";
  variant?: "flat" | "flip"; // flip は sort-submit の公開演出用
  flipped?: boolean; // variant=flip のときに数値面を表示するか
};

export function GameCard({
  index,
  name,
  clue,
  number,
  state = "default",
  variant = "flat",
  flipped = false,
}: GameCardProps) {
  const recipe = useSlotRecipe({ key: "gameCard" });
  const styles: any = recipe({ state, variant });
  const [isHovered, setIsHovered] = useState(false);

  // 🎮 PREMIUM GAME DESIGN: シンプル化（ファクションカラー無効化）
  // const factionStyles = null; // 削除済み
  // const faction = null; // 削除済み

  // 🎮 PREMIUM CARD ANIMATIONS
  const flipTransform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";
  const hoverTransform = isHovered ? "translateY(-8px) scale(1.05)" : "translateY(0) scale(1)";
  const hoverShadow = isHovered 
    ? "0 20px 40px rgba(0,0,0,0.4), 0 8px 16px rgba(255,122,26,0.3)"
    : "0 4px 12px rgba(0,0,0,0.15)";

  // テキストのはみ出し対策（共通）
  const clamp2Css: any = {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
    wordBreak: "break-word",
    overflowWrap: "anywhere",
  };
  const oneLineEllipsis: any = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
  };

  if (variant === "flip") {
    return (
      <Box
        css={{
          ...styles.container,
          // === 2025年 DPI対応 コンテナサイズ ===
          aspectRatio: "5 / 7",
          width: UNIFIED_LAYOUT.CARD.WIDTH,
          height: "auto",
          placeSelf: "start",
          containerType: "inline-size",
          
          // 🎮 PREMIUM INTERACTION STATES
          cursor: "pointer",
          transform: hoverTransform,
          boxShadow: hoverShadow,
          transition: `transform 0.3s ${HOVER_EASING}, box-shadow 0.3s ${HOVER_EASING}`,
          willChange: "transform, box-shadow",
        }}
        role="group"
        aria-label="card"
        tabIndex={0}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        _focusVisible={{
          outline: "2px solid",
          outlineColor: "focusRing",
          outlineOffset: 2,
        }}
        _active={{
          transform: "translateY(-4px) scale(1.02)",
        }}
      >
        <Box
          css={{
            ...styles.inner,
            transition: `transform 0.9s ${CARD_FLIP_EASING}`,
          }}
          style={{ transform: flipTransform }}
          aria-live="polite"
          className="gamecard-inner"
        >
          <Box css={styles.front}>
            <Text fontSize="xs" color="fgMuted" mb={1}>
              #{typeof index === "number" ? index + 1 : "?"}
            </Text>
            <Text
              className="gc-main"
              fontWeight="900"
              fontSize="md"
              textAlign="center"
              css={clamp2Css}
            >
              {clue || "(連想なし)"}
            </Text>
            <Text
              mt={2}
              className="gc-name"
              fontSize="xs"
              color="fgMuted"
              css={oneLineEllipsis}
            >
              {name ?? "(不明)"}
            </Text>
          </Box>
          <Box css={styles.back}>
            <Text fontSize="xs" color="fgMuted" mb={1}>
              #{typeof index === "number" ? index + 1 : "?"}
            </Text>
            <Text fontWeight="900" fontSize="3xl" textAlign="center">
              {typeof number === "number" ? number : "?"}
            </Text>
            <Text
              mt={2}
              className="gc-name"
              fontSize="xs"
              color="fgMuted"
              css={oneLineEllipsis}
            >
              {name ?? "(不明)"}
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  // Token ベースの簡素スタイル (flat variant 用)
  const frameBorderColor =
    state === "success"
      ? "successBorder"
      : state === "fail"
        ? "dangerBorder"
        : "borderDefault";
  // If the card doesn't have a numeric value (we're showing a clue), use a
  // slightly lighter surface so placed-but-unrevealed cards don't look like
  // the final dark "back" state.
  const frameBg =
    state === "success"
      ? "successSubtle"
      : state === "fail"
        ? "dangerSubtle"
        : typeof number === "number"
          ? "surfaceRaised"
          : "surfaceSubtle";
  const frameShadow =
    state === "default"
      ? "0 2px 6px rgba(0,0,0,0.4)"
      : "0 0 0 1px rgba(0,0,0,0.4)";

  return (
    <Box
      css={{
        // === 2025年 DPI対応 フレームサイズ ===
        aspectRatio: "5 / 7",
        width: UNIFIED_LAYOUT.CARD.WIDTH,
        height: "auto", // aspect-ratioが制御

        // Grid アイテムとしての最適化
        placeSelf: "start",
        containerType: "inline-size",

        background: frameBg,
        border: `1px solid`,
        borderColor: frameBorderColor,
        boxShadow: frameShadow,
        color: "var(--chakra-colors-fgDefault)",

        // 🎮 PREMIUM FLAT CARD INTERACTIONS
        cursor: "pointer",
        transform: hoverTransform,
        transition: `all 0.3s ${HOVER_EASING}`,
        willChange: "transform, box-shadow, border-color",

        // ホバー効果
        "&:hover": {
          background: state === "default" ? "var(--chakra-colors-cardHoverBg)" : frameBg,
          borderColor: state === "default" ? "var(--chakra-colors-borderAccent)" : frameBorderColor,
          boxShadow: hoverShadow,
        },
        "&:active": { 
          transform: "translateY(-2px) scale(0.98)",
          boxShadow: "0 8px 20px rgba(0,0,0,0.2)"
        },
      }}
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      _focusVisible={{
        outline: `2px solid #60a5fa`,
        outlineOffset: 2,
      }}
    >
      {typeof index === "number" && (
        <Text
          fontSize="sm"
          color="rgba(255,255,255,0.6)"
          css={{
            fontFamily: '"Cinzel Decorative", serif',
            fontWeight: 600,
            letterSpacing: "0.03em",
            textShadow: "0 1px 6px rgba(255,255,255,0.3)",
            fontSize: "0.75rem",
          }}
        >
          #{index + 1}
        </Text>
      )}

      {/* 🎮 PREMIUM NUMBER DISPLAY */}
      <Text
        className="gc-main"
        textAlign="center"
        css={{
          ...(typeof number === "number" ? undefined : clamp2Css),
          // プレミアムタイポグラフィ（インライン化）
          fontFamily: typeof number === "number" 
            ? '"Orbitron", "Courier New", monospace'
            : '"Cinzel Decorative", serif',
          fontWeight: typeof number === "number" ? 800 : 600,
          letterSpacing: typeof number === "number" ? "0.02em" : "0.03em",
          textShadow: typeof number === "number" 
            ? "0 1px 4px rgba(0,0,0,0.6)" 
            : "0 1px 6px rgba(255,255,255,0.3)",
          fontSize: typeof number === "number" ? "2rem" : "1.25rem",
          // ファクション別カラー
          color: "rgba(255,255,255,0.95)",
          // グロー効果
          filter:
            typeof number === "number"
              ? `drop-shadow(0 0 8px rgba(255,255,255,0.3))`
              : undefined,
        }}
      >
        {typeof number === "number" ? number : clue || "?"}
      </Text>

      {/* 🎮 PREMIUM CLUE DISPLAY */}
      <Text
        mt={2}
        className="gc-clue"
        fontSize="xs"
        css={{
          ...oneLineEllipsis,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
          fontWeight: 500,
          letterSpacing: "-0.01em",
          fontSize: "0.875rem",
          color: "rgba(255,255,255,0.8)",
          textShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}
      >
        {clue || "(連想なし)"}
      </Text>
    </Box>
  );
}

export default GameCard;
