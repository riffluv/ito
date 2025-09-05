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
        color={failed ? "#ef4444" : "#22c55e"}
        letterSpacing={2}
        // 成功を表現する意味のあるボーダー
        border="borders.retrogame"
        borderColor={failed ? "rgba(239, 68, 68, 0.9)" : "rgba(34, 197, 94, 0.9)"}
        transform="scale(1)"
        opacity={1}
        animation={failed ? "shakeFailure 0.6s ease-out" : "successPulse 1.2s ease-out"}
        css={{
          // 成功/失敗に応じた背景色（人間らしい感情表現）
          background: failed 
            ? "rgba(20, 8, 8, 0.95)" // 失敗時は暖色系
            : "rgba(8, 20, 12, 0.95)", // 成功時は寒色系
          // 控えめなテクスチャで品格維持
          backgroundImage:
            "radial-gradient(circle at 1.5px 1.5px, rgba(255,255,255,0.03) 1px, transparent 0)",
          backgroundSize: "18px 18px",
          backdropFilter: "blur(10px)",
          // 意味のある影 - 成功は上向き、失敗は重い
          boxShadow: failed
            ? "0 8px 32px rgba(239,68,68,0.15), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)"
            : "0 12px 40px rgba(34,197,94,0.2), 0 4px 12px rgba(34,197,94,0.1), inset 0 1px 0 rgba(255,255,255,0.08)",
          // 意味のあるアニメーション
          "@keyframes successPulse": {
            "0%": {
              transform: "scale(0.9)",
              opacity: 0,
            },
            "40%": {
              transform: "scale(1.02)",
              opacity: 1,
            },
            "70%": {
              transform: "scale(0.98)",
            },
            "100%": {
              transform: "scale(1)",
              opacity: 1,
            },
          },
          "@keyframes shakeFailure": {
            "0%, 100%": {
              transform: "translateX(0) scale(1)",
              opacity: 1,
            },
            "10%, 30%, 50%, 70%, 90%": {
              transform: "translateX(-2px) scale(1.01)",
            },
            "20%, 40%, 60%, 80%": {
              transform: "translateX(2px) scale(0.99)",
            },
          },
        }}
      >
        {failed ? "💥 Failed" : "✨ Success ✨"}
        <Text
          fontSize={{ base: "md", md: "lg" }}
          mt={2}
          opacity={0.9}
          fontFamily='-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
          fontWeight={500}
          letterSpacing="-0.01em"
        >
          {failed ? "Try again!" : "Perfect order"}
        </Text>
      </Box>
    </Box>
  );
}
