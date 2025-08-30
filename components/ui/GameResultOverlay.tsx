import React from "react";
import { Box, Text } from "@chakra-ui/react";
import { UNIFIED_LAYOUT } from "@/theme/layout";

interface GameResultOverlayProps {
  failed?: boolean;
  failedAt?: number | null;
  mode?: "overlay" | "inline"; // overlay: 中央に被せる, inline: 帯として表示
}

export function GameResultOverlay({ failed, failedAt, mode = "overlay" }: GameResultOverlayProps) {
  // インライン表示: カードと被せず帯として表示
  if (mode === "inline") {
    return failed ? (
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        gap={2}
        px={3}
        py={2}
        rounded="lg"
        fontWeight={800}
        fontSize={{ base: "sm", md: "md" }}
        color="red.800"
        boxShadow={UNIFIED_LAYOUT.ELEVATION.CARD.RAISED}
        bg="red.100"
        border="1px solid"
        borderColor="red.200"
        whiteSpace="nowrap"
        aria-live="polite"
        role="status"
      >
        <span aria-hidden>💥</span> FAILED{typeof failedAt === "number" ? ` #${failedAt}` : ""}
      </Box>
    ) : (
      <Box
        as="span"
        display="inline-flex"
        alignItems="center"
        gap={2}
        px={3}
        py={2}
        rounded="lg"
        fontWeight={800}
        fontSize={{ base: "sm", md: "md" }}
        color="green.800"
        boxShadow={UNIFIED_LAYOUT.ELEVATION.CARD.RAISED}
        bg="green.100"
        border="1px solid"
        borderColor="green.200"
        whiteSpace="nowrap"
        aria-live="polite"
        role="status"
      >
        <span aria-hidden>🎉</span> SUCCESS!!
      </Box>
    );
  }

  if (failed) {
    return (
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        zIndex={10}
      >
        <Box
          px={6}
          py={4}
          rounded="xl"
          fontWeight={800}
          fontSize={{ base: "xl", md: "2xl" }}
          color="white"
          letterSpacing={1}
          boxShadow={UNIFIED_LAYOUT.ELEVATION.CARD.ELEVATED}
          bgGradient="dangerStrong"
          transform="translateX(0)"
          animation="shake 0.6s ease-in-out"
          css={{
            "@keyframes shake": {
              "0%, 100%": { transform: "translateX(0)" },
              "10%, 30%, 50%, 70%, 90%": {
                transform: "translateX(-6px)",
              },
              "20%, 40%, 60%, 80%": { transform: "translateX(6px)" },
            },
          }}
        >
          💥 FAILED 💥
          <Text
            fontSize={{ base: "sm", md: "md" }}
            mt={1}
            opacity={0.9}
          >
            #{failedAt} 枚目で昇順が崩れました
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      position="absolute"
      top="50%"
      left="50%"
      transform="translate(-50%, -50%)"
      zIndex={10}
    >
      <Box
        px={8}
        py={5}
        rounded="2xl"
        fontWeight={800}
        fontSize={{ base: "2xl", md: "3xl" }}
        color="successSolid"
        letterSpacing={2}
        boxShadow={UNIFIED_LAYOUT.ELEVATION.CARD.ELEVATED}
        transform="scale(1) rotate(0deg)"
        opacity={1}
        animation="celebrate 0.8s ease-out"
        css={{
          "@keyframes celebrate": {
            "0%": {
              transform: "scale(0.8) rotate(-5deg)",
              opacity: 0,
            },
            "50%": {
              transform: "scale(1.05) rotate(1deg)",
              opacity: 1,
            },
            "100%": {
              transform: "scale(1) rotate(0deg)",
              opacity: 1,
            },
          },
        }}
      >
        🎉 SUCCESS!! 🎉
        <Text
          fontSize={{ base: "md", md: "lg" }}
          mt={2}
          opacity={0.9}
        >
          完璧な順序でクリア！
        </Text>
      </Box>
    </Box>
  );
}
