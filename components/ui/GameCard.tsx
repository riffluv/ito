"use client";
import { Box, Text, useSlotRecipe } from "@chakra-ui/react";
import { UNIFIED_LAYOUT } from "@/theme/layout";

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
            <Text className="gc-main" fontWeight="900" fontSize="md" textAlign="center" css={clamp2Css}>
              {clue || "(連想なし)"}
            </Text>
            <Text mt={2} className="gc-name" fontSize="xs" color="fgMuted" css={oneLineEllipsis}>
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
            <Text mt={2} className="gc-name" fontSize="xs" color="fgMuted" css={oneLineEllipsis}>
              {name ?? "(不明)"}
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      css={{
        ...styles.frame,
        // === 2025年 DPI対応 フレームサイズ ===
        aspectRatio: "5 / 7",
        width: UNIFIED_LAYOUT.CARD.WIDTH,
        height: "auto", // aspect-ratioが制御
        
        // Grid アイテムとしての最適化
        placeSelf: "start",
        containerType: "inline-size",
        
        // フォントの段階的縮小は簡略化（ブラウザ警告回避）
      }}
      tabIndex={0}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "focusRing",
        outlineOffset: 2,
      }}
    >
      {typeof index === "number" && (
        <Text fontSize="sm" color="fgMuted">
          #{index + 1}
        </Text>
      )}
      <Text
        className="gc-main"
        fontWeight="900"
        fontSize="xl"
        textAlign="center"
        css={typeof number === "number" ? undefined : clamp2Css}
      >
        {typeof number === "number" ? number : clue || "?"}
      </Text>
      <Text mt={2} className="gc-name" fontSize="xs" color="fgMuted" css={oneLineEllipsis}>
        {name ?? "(不明)"}
      </Text>
    </Box>
  );
}

export default GameCard;
