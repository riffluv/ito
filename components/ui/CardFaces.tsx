"use client";

import { Box } from "@chakra-ui/react";

import styles from "./GameCard.module.css";

import { UI_TOKENS } from "@/theme/layout";

import { getClueFontSize, getNumberFontSize } from "./CardText";

import { WAITING_LABEL } from "@/lib/ui/constants";



const getUnifiedTextStyle = (): React.CSSProperties => ({

  fontFamily:

    `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif`,

  fontWeight: 400,

  fontStyle: "normal",

  letterSpacing: "normal",

  textRendering: "optimizeLegibility",

  WebkitFontSmoothing: "antialiased",

  MozOsxFontSmoothing: "grayscale",

});

// HD-2D風カードの共通スタイル（指示書v2準拠）
// ::before = 内側の二重線ハイライト
// ::after = 上部の月光グラデーション
const HD2D_CARD_PSEUDO_STYLES = {
  _before: {
    content: '""',
    position: "absolute" as const,
    inset: "2px",
    borderRadius: "5px",
    border: "var(--card-border-width-inner) solid var(--card-border-inner)",
    borderTopColor: "var(--card-border-highlight)",
    pointerEvents: "none" as const,
    // Watermark用フック
    backgroundImage: "var(--card-watermark-image)",
    backgroundPosition: "var(--card-watermark-position)",
    backgroundSize: "var(--card-watermark-size)",
    backgroundRepeat: "no-repeat",
  },
  _after: {
    content: '""',
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
    background: `linear-gradient(178deg, var(--card-light-moon) 0%, transparent 70%)`,
    borderRadius: "6px 6px 0 0",
    pointerEvents: "none" as const,
  },
};

const CARD_META_FONT_SIZE = "calc(var(--chakra-fontSizes-2xs) * var(--card-text-scale))";



type FrontProps = {

  index: number | null | undefined;

  name?: string;

  clue?: string;

  metaColor: string;

  clueColor: string;

  bg: string;

  border: string;

  borderColor: string;

  boxShadow: string;

  waitingInCentral: boolean;

};



export function CardFaceFront({

  index,

  name,

  clue,

  metaColor,

  clueColor,

  bg,

  border,

  borderColor,

  boxShadow,

  waitingInCentral,

}: FrontProps) {

  return (

    <Box

      width="100%"

      height="100%"

      p={{ base: 3, md: "var(--card-pad-md, 13px)" }}

      // HD-2D風: 角丸を微差で調整（7px = 8pxより少し小さく、手触り感）
      borderRadius="7px"

      border={border}

      borderColor={borderColor}

      bg={bg}

      color={UI_TOKENS.COLORS.textBase}

      display="grid"

      gridTemplateRows="16px 1fr 16px"

      alignItems="stretch"

      boxShadow={boxShadow}

      // AI感除去: 0.3s → 0.28s、イージングも微調整
      transition="background-color 0.28s cubic-bezier(0.3, 0.7, 0.4, 1), border-color 0.28s cubic-bezier(0.3, 0.7, 0.4, 1), box-shadow 0.28s cubic-bezier(0.3, 0.7, 0.4, 1)"

      overflow="hidden"

      position="relative"

      // HD-2D風の疑似要素（二重枠＋月光グラデ）
      {...HD2D_CARD_PSEUDO_STYLES}

    >

      <Box fontSize={CARD_META_FONT_SIZE} lineHeight="1.3" style={getUnifiedTextStyle()} color={metaColor} display="flex" alignItems="center">

        <span className={styles.cardMeta}>#{typeof index === "number" ? index + 1 : "?"}</span>

      </Box>

      <Box position="relative">

        <Box

          position="absolute"

          top="50%"

          left="50%"

          transform="translate3d(-50%, -50%, 0)"

          fontWeight={700}

          fontSize={getClueFontSize(clue)}

          color={clueColor}

          lineHeight="1.3"

          width="100%"

          maxWidth="calc(100% - (6px * var(--card-text-scale)))"

          textAlign="center"

          padding="0 calc(0.2rem * var(--card-text-scale))"

          wordBreak={clue === WAITING_LABEL ? "keep-all" : "break-word"}

          whiteSpace={clue === WAITING_LABEL ? "nowrap" : "normal"}

          overflowWrap="anywhere"

          overflow="hidden"

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

      <Box fontSize={CARD_META_FONT_SIZE} lineHeight="1.3" style={getUnifiedTextStyle()} color={metaColor} display="flex" alignItems="center" justifyContent="flex-start" textAlign="left">

        <span className={styles.cardMeta}>{name ?? "(不明)"}</span>

      </Box>

    </Box>

  );

}



type BackProps = {

  index: number | null | undefined;

  name?: string;

  number: number | null | undefined;

  metaColor: string;

  numberColor: string;

  bg: string;

  border: string;

  borderColor: string;

  boxShadow: string;

  waitingInCentral: boolean;

};



export function CardFaceBack({

  index,

  name,

  number,

  metaColor,

  numberColor,

  bg,

  border,

  borderColor,

  boxShadow,

  waitingInCentral,

}: BackProps) {

  const backNumberFontSize = getNumberFontSize(

    typeof number === "number" ? number : null

  );

  return (

    <Box

      width="100%"

      height="100%"

      p={{ base: 3, md: "var(--card-pad-md, 13px)" }}

      // HD-2D風: 角丸を微差で調整（7px = 8pxより少し小さく、手触り感）
      borderRadius="7px"

      border={border}

      borderColor={borderColor}

      bg={bg}

      color={UI_TOKENS.COLORS.textBase}

      display="grid"

      gridTemplateRows="16px 1fr 16px"

      alignItems="stretch"

      boxShadow={boxShadow}

      // AI感除去: 0.3s → 0.28s、イージングも微調整
      transition="background-color 0.28s cubic-bezier(0.3, 0.7, 0.4, 1), border-color 0.28s cubic-bezier(0.3, 0.7, 0.4, 1), box-shadow 0.28s cubic-bezier(0.3, 0.7, 0.4, 1)"

      overflow="hidden"

      position="relative"

      // HD-2D風の疑似要素（二重枠＋月光グラデ）
      {...HD2D_CARD_PSEUDO_STYLES}

    >

      <Box fontSize={CARD_META_FONT_SIZE} lineHeight="1.3" style={getUnifiedTextStyle()} color={metaColor} display="flex" alignItems="center">

        <span className={styles.cardMeta}>#{typeof index === "number" ? index + 1 : "?"}</span>

      </Box>

      <Box position="relative">

        <Box

          position="absolute"

          top="50%"

          left="50%"

          transform="translate3d(-50%, -50%, 0)"

          fontWeight={700}

          fontSize={backNumberFontSize}

          color={numberColor}

          lineHeight="1.3"

          textShadow={waitingInCentral ? UI_TOKENS.TEXT_SHADOWS.none : UI_TOKENS.TEXT_SHADOWS.soft}

          width="100%"

          textAlign="center"

          whiteSpace="nowrap"

          letterSpacing={
            typeof number === "number" && String(number).length >= 3 ? "-0.8px" : undefined
          }

        >

          {typeof number === "number" ? number : ""}

        </Box>

      </Box>

      <Box fontSize={CARD_META_FONT_SIZE} lineHeight="1.3" style={getUnifiedTextStyle()} color={metaColor} display="flex" alignItems="center" justifyContent="flex-start" textAlign="left">

        <span className={styles.cardMeta}>{name ?? "(不明)"}</span>

      </Box>

    </Box>

  );

}
