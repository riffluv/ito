import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Text } from "@chakra-ui/react";

interface GameResultOverlayProps {
  failed?: boolean;
  failedAt?: number | null;
  mode?: "overlay" | "inline"; // overlay: 中央に被せる, inline: 帯として表示
}

export function GameResultOverlay({
  failed,
  failedAt,
  mode = "overlay",
}: GameResultOverlayProps) {
  // インライン表示: カードと被せず帯として表示
  if (mode === "inline") {
    if (failed) {
      return (
        <Box
          as="span"
          display="inline-block"
          px={1}
          fontWeight={700}
          fontSize={{ base: "sm", md: "sm" }}
          color="red.400"
          letterSpacing={0.5}
          whiteSpace="nowrap"
          aria-live="polite"
          role="status"
        >
          Failed{typeof failedAt === "number" ? ` #${failedAt}` : ""}
        </Box>
      );
    }
    return (
      <Box
        as="span"
        display="inline-block"
        px={1}
        fontWeight={700}
        fontSize={{ base: "sm", md: "sm" }}
        color="#22c55e"
        letterSpacing={0.5}
        whiteSpace="nowrap"
        aria-live="polite"
        role="status"
      >
        Success
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
        color="#22c55e"
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
        ✨ Success ✨
        <Text
          fontSize={{ base: "md", md: "lg" }}
          mt={2}
          opacity={0.9}
          fontFamily='-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
          fontWeight={500}
          letterSpacing="-0.01em"
        >
          Perfect order
        </Text>
      </Box>
    </Box>
  );
}
