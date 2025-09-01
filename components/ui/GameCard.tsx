"use client";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Text, useSlotRecipe } from "@chakra-ui/react";
// LEGACY PREMIUM (to be refactored): premiumGameStyles 依存を今後 surface/accent トークン + recipe へ再マップ予定
import {
  PREMIUM_TYPOGRAPHY,
  getFactionStyles,
  getNumberFaction,
} from "@/theme/premiumGameStyles";

// premiumGameStyles 依存除去済み: 旧 import を削除

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

  // 🎮 PREMIUM GAME DESIGN: ファクションカラーシステム
  const factionStyles =
    typeof number === "number" ? getFactionStyles(number) : null;
  const faction = typeof number === "number" ? getNumberFaction(number) : null;

  // reduced motion 対応: CSS prefers-reduced-motion を利用し inner の transition を打ち消し
  const flipTransform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";

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
          height: "auto", // aspect-ratioが制御

          // Grid アイテムとしての最適化
          placeSelf: "start",
          // フォントの自動縮小: コンテナクエリで微調整（簡略化して警告回避）
          containerType: "inline-size",
        }}
        role="group"
        aria-label="card"
        tabIndex={0}
        _focusVisible={{
          outline: "2px solid",
          outlineColor: "focusRing",
          outlineOffset: 2,
        }}
      >
        <Box
          css={styles.inner}
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
  const frameBg =
    state === "success"
      ? "successSubtle"
      : state === "fail"
        ? "dangerSubtle"
        : "surfaceRaised";
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

        // プレミアムアニメーション
        transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        cursor: "pointer",

        // ホバー効果
        "&:hover": {
          background:
            state === "default" ? "var(--chakra-colors-cardHoverBg)" : frameBg,
        },
        "&:active": { transform: "translateY(1px) scale(.98)" },
      }}
      tabIndex={0}
      _focusVisible={{
        outline: `2px solid ${factionStyles?.primary || "#60a5fa"}`,
        outlineOffset: 2,
      }}
    >
      {typeof index === "number" && (
        <Text
          fontSize="sm"
          color="rgba(255,255,255,0.6)"
          css={{
            ...PREMIUM_TYPOGRAPHY.MYSTICAL_TEXT,
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
          // プレミアムタイポグラフィ
          ...(typeof number === "number"
            ? PREMIUM_TYPOGRAPHY.CARD_NUMBER
            : PREMIUM_TYPOGRAPHY.MYSTICAL_TEXT),
          fontSize: typeof number === "number" ? "2.5rem" : "1.25rem",
          fontWeight: typeof number === "number" ? 900 : 600,
          // ファクション別カラー
          color:
            typeof number === "number" && factionStyles
              ? factionStyles.primary
              : "rgba(255,255,255,0.95)",
          // プレミアムテキストエフェクト
          textShadow:
            typeof number === "number" && factionStyles
              ? `0 0 20px ${factionStyles.glow}, 0 2px 8px rgba(0,0,0,0.8)`
              : "0 2px 8px rgba(0,0,0,0.8)",
          // グロー効果
          filter:
            typeof number === "number"
              ? `drop-shadow(0 0 8px ${factionStyles?.glow || "rgba(255,255,255,0.3)"})`
              : undefined,
        }}
      >
        {typeof number === "number" ? number : clue || "?"}
      </Text>

      {/* 🎮 PREMIUM NAME DISPLAY */}
      <Text
        mt={2}
        className="gc-name"
        fontSize="xs"
        css={{
          ...oneLineEllipsis,
          ...PREMIUM_TYPOGRAPHY.MYSTICAL_TEXT,
          fontSize: "0.7rem",
          color: "rgba(255,255,255,0.7)",
          textShadow: "0 1px 4px rgba(0,0,0,0.6)",
        }}
      >
        {name ?? "(不明)"}
      </Text>
    </Box>
  );
}

export default GameCard;
