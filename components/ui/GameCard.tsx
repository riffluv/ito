"use client";
import { CARD_FLIP_EASING, HOVER_EASING } from "@/lib/ui/motion";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import { useState } from "react";

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

// 統一されたボーダー設定関数
const getBorderStyle = (waitingInCentral: boolean, state: string) => {
  if (waitingInCentral) {
    return { border: "none", borderColor: undefined };
  }
  
  const borderWidth = "1.5px";
  const borderStyle = "solid"; // 🎯 統一: 全ての状態で実線ボーダー
  
  // テーマトークンを使用した統一ボーダー色
  const borderColor = state === "success" 
    ? "borderAccent" // テーマのアクセント色（青系）
    : state === "fail" 
      ? "dangerSolid" // テーマの危険色（赤系）
      : "borderStrong"; // テーマの強い白系ボーダー
      
  return {
    border: `${borderWidth} ${borderStyle}`,
    borderColor,
  };
};

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
  waitingInCentral = false,
}: GameCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  
  // 統一されたボーダースタイルを取得
  const borderStyle = getBorderStyle(waitingInCentral, state);

  // Debug log for Dragon Quest style
  if (waitingInCentral) {
    console.log("🐉 Dragon Quest style applied to card:", {
      name,
      index,
      clue,
    });
  }

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
    const hoverTransform = isHovered ? "translateY(-4px)" : "translateY(0)";
    const flipTransform = flipped ? "rotateY(180deg)" : "rotateY(0deg)";

    const digits = typeof number === "number" ? String(number).length : 0;
    const backNumberFontSize = (() => {
      if (digits <= 1) return "3rem";
      if (digits === 2) return "2.8rem";
      if (digits === 3) return "2.35rem"; // 100 用に縮小
      return "2.2rem"; // フォールバック (想定外の多桁)
    })();

    return (
      <Box
        style={{
          perspective: "1000px",
        }}
        width={UNIFIED_LAYOUT.CARD.WIDTH}
        height={UNIFIED_LAYOUT.CARD.HEIGHT}
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
            transform: `${flipTransform} ${hoverTransform}`,
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
            }}
            p={{ base: 3, md: "13px" }}
            borderRadius="lg"
            border={borderStyle.border}
            borderColor={borderStyle.borderColor}
            bg={waitingInCentral ? "#191b21" : "#1a1a1a"}
            color={waitingInCentral ? "#ffffff" : "cardFrontText"}
            display="grid"
            gridTemplateRows="16px 1fr 16px"
            alignItems="stretch"
            boxShadow={
              waitingInCentral
                ? "0 4px 12px rgba(0,0,0,0.15)"
                : isHovered
                  ? "lg"
                  : "md"
            }
            transition="all 0.3s ease"
          >
            <Box
              fontSize="2xs"
              lineHeight="1"
              color={waitingInCentral ? "rgba(255, 255, 255, 0.8)" : "cardMeta"}
              display="flex"
              alignItems="center"
            >
              #{typeof index === "number" ? index + 1 : "?"}
            </Box>
            <Box position="relative">
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                fontWeight="700"
                fontSize={{ base: "lg", md: "xl" }}
                textAlign="center"
                lineHeight="1.15"
                width="100%"
                px="1"
                wordBreak="keep-all"
                color={waitingInCentral ? "#ffffff" : "cardClueText"}
                style={
                  waitingInCentral
                    ? {
                        textShadow: "none",
                      }
                    : undefined
                }
              >
                {clue || "(連想なし)"}
              </Box>
            </Box>
            <Box
              fontSize="2xs"
              lineHeight="1"
              color={waitingInCentral ? "rgba(255, 255, 255, 0.7)" : "cardMeta"}
              display="flex"
              alignItems="center"
              justifyContent="flex-start"
              textAlign="left"
            >
              {name ?? "(不明)"}
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
              transform: "rotateY(180deg)",
            }}
            p={{ base: 3, md: "13px" }}
            borderRadius="lg"
            border={borderStyle.border}
            borderColor={borderStyle.borderColor}
            bg={waitingInCentral ? "#191b21" : "#1a1a1a"}
            boxShadow={
              waitingInCentral
                ? "0 4px 12px rgba(0,0,0,0.15)"
                : state === "success"
                  ? "success"
                  : state === "fail"
                    ? "fail"
                    : isHovered
                      ? "lg"
                      : "md"
            }
            color={waitingInCentral ? "#ffffff" : "cardBackText"}
            display="grid"
            gridTemplateRows="16px 1fr 16px"
            transition="all 0.3s ease"
          >
            <Box
              fontSize="2xs"
              lineHeight="1"
              color={waitingInCentral ? "rgba(255, 255, 255, 0.8)" : "cardMeta"}
              display="flex"
              alignItems="center"
            >
              #{typeof index === "number" ? index + 1 : "?"}
            </Box>
            <Box position="relative">
              <Box
                position="absolute"
                top="50%"
                left="50%"
                transform="translate(-50%, -50%)"
                fontWeight="900"
                fontSize={backNumberFontSize}
                color={waitingInCentral ? "#ffffff" : "cardNumber"}
                lineHeight="1"
                textShadow={
                  waitingInCentral
                    ? "none"
                    : "cardNumberShadow"
                }
                width="100%"
                textAlign="center"
                whiteSpace="nowrap"
                letterSpacing={digits >= 3 ? "-1px" : undefined}
              >
                {typeof number === "number" ? number : ""}
              </Box>
            </Box>
            <Box
              fontSize="2xs"
              lineHeight="1"
              color={waitingInCentral ? "rgba(255, 255, 255, 0.7)" : "cardMeta"}
              display="flex"
              alignItems="center"
              justifyContent="flex-start"
              textAlign="left"
            >
              {name ?? "(不明)"}
            </Box>
          </Box>
        </div>
      </Box>
    );
  }

  // FLAT VARIANT - 通常のカード表示
  const hoverTransform = isHovered
    ? "translateY(-4px) scale(1.02)"
    : "translateY(0) scale(1)";

  return (
    <Box
      width={UNIFIED_LAYOUT.CARD.WIDTH}
      height={UNIFIED_LAYOUT.CARD.HEIGHT}
      minW={UNIFIED_LAYOUT.CARD.WIDTH}
      minH={UNIFIED_LAYOUT.CARD.HEIGHT}
      p="0.75rem 0.85rem 0.75rem"
      borderRadius="lg"
      border={borderStyle.border}
      borderColor={borderStyle.borderColor}
      bg={waitingInCentral ? "#191b21" : "#1a1a1a"}
      color={waitingInCentral ? "#ffffff" : "#ffffff"}
      display="grid"
      gridTemplateRows="16px 1fr 16px"
      cursor="pointer"
      transform={hoverTransform}
      transition={`all 0.3s ${HOVER_EASING}`}
      boxShadow={
        waitingInCentral
          ? "0 4px 12px rgba(0,0,0,0.15)"
          : state === "success"
            ? mergeShadow(`${successShadow}, 0 8px 25px rgba(0,0,0,0.3)`)
            : state === "fail"
              ? mergeShadow("0 0 0 3px rgba(220,38,38,0.35), 0 8px 25px rgba(0,0,0,0.3)")
              : isHovered
                ? mergeShadow("0 8px 25px rgba(0,0,0,0.3)")
                : mergeShadow("0 4px 12px rgba(0,0,0,0.15)")
      }
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Box
        fontSize="2xs"
        lineHeight={1}
        color={waitingInCentral ? "rgba(255, 255, 255, 0.8)" : "#999"}
        display="flex"
        alignItems="center"
      >
        #{typeof index === "number" ? index + 1 : "?"}
      </Box>
      <Box position="relative">
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          fontWeight={typeof number === "number" ? 900 : 700}
          fontSize={
            typeof number === "number"
              ? (() => {
                  const digits = String(number).length;
                  if (digits <= 1) return "2.6rem";
                  if (digits === 2) return "2.45rem";
                  if (digits === 3) return "2.05rem"; // 100 対策
                  return "1.9rem";
                })()
              : "1.22rem"
          }
          color={
            waitingInCentral
              ? "#ffffff" // White numbers for waiting cards (Dragon Quest style)
              : state === "success"
                ? "#3b82f6" // Blue for success
                : state === "fail"
                  ? "#dc2626" // Red for failure  
                  : "#ffffff" // White for pending/default
          }
          lineHeight={1.05}
          textShadow={
            waitingInCentral
              ? "none" // Clean white text without shadow for waiting cards
              : typeof number === "number"
                ? "0 2px 4px rgba(0,0,0,0.5)"
                : "none"
          }
          width="100%"
          textAlign="center"
          padding="0 0.25rem"
          wordBreak="keep-all"
          whiteSpace="nowrap"
          letterSpacing={
            typeof number === "number" && String(number).length >= 3
              ? "-1px"
              : undefined
          }
        >
          {typeof number === "number" ? number : clue || "?"}
        </Box>
      </Box>
      <Box
        fontSize="2xs"
        lineHeight={1}
        color={waitingInCentral ? "rgba(255, 255, 255, 0.7)" : "#999"}
        display="flex"
        alignItems="center"
        justifyContent="flex-start"
        textAlign="left"
      >
        {name ?? "(不明)"}
      </Box>
    </Box>
  );
}

export default GameCard;
