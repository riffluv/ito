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

      p={{ base: 3, md: "13px" }}

      borderRadius="8px"

      border={border}

      borderColor={borderColor}

      bg={bg}

      color={UI_TOKENS.COLORS.textBase}

      display="grid"

      gridTemplateRows="16px 1fr 16px"

      alignItems="stretch"

      boxShadow={boxShadow}

      transition="background-color 0.31s ease, border-color 0.31s ease, box-shadow 0.31s ease" // AI感除去: 0.3s → 0.31s

      overflow="hidden"

    >

      <Box fontSize="2xs" lineHeight="1.3" style={getUnifiedTextStyle()} color={metaColor} display="flex" alignItems="center">

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

          maxWidth="calc(100% - 6px)"

          textAlign="center"

          padding="0 0.2rem"

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

      <Box fontSize="2xs" lineHeight="1.3" style={getUnifiedTextStyle()} color={metaColor} display="flex" alignItems="center" justifyContent="flex-start" textAlign="left">

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

      p={{ base: 3, md: "13px" }}

      borderRadius="8px"

      border={border}

      borderColor={borderColor}

      bg={bg}

      color={UI_TOKENS.COLORS.textBase}

      display="grid"

      gridTemplateRows="16px 1fr 16px"

      alignItems="stretch"

      boxShadow={boxShadow}

      transition="background-color 0.31s ease, border-color 0.31s ease, box-shadow 0.31s ease" // AI感除去: 0.3s → 0.31s

      overflow="hidden"

    >

      <Box fontSize="2xs" lineHeight="1.3" style={getUnifiedTextStyle()} color={metaColor} display="flex" alignItems="center">

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

      <Box fontSize="2xs" lineHeight="1.3" style={getUnifiedTextStyle()} color={metaColor} display="flex" alignItems="center" justifyContent="flex-start" textAlign="left">

        <span className={styles.cardMeta}>{name ?? "(不明)"}</span>

      </Box>

    </Box>

  );

}
