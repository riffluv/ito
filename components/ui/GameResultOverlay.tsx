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
          px={2}
          py={1}
          fontWeight={700}
          fontSize={{ base: "sm", md: "sm" }}
          color="white" // ドラクエ風白文字統一
          letterSpacing={0.5}
          whiteSpace="nowrap"
          aria-live="polite"
          role="status"
          fontFamily="monospace" // ドラクエ風フォント
          textShadow="1px 1px 0px #000" // ドラクエ風テキストシャドウ
          bg="rgba(8,9,15,0.8)" // ドラクエ風リッチブラック背景
          border="2px solid rgba(255,255,255,0.9)" // ドラクエ風ボーダー
          borderRadius={0} // 角ばったデザイン
        >
          💥 しっぱい{typeof failedAt === "number" ? ` #${failedAt}` : ""}
        </Box>
      );
    }
    return (
      <Box
        as="span"
        display="inline-block"
        px={2}
        py={1}
        fontWeight={700}
        fontSize={{ base: "sm", md: "sm" }}
        color="white" // ドラクエ風白文字統一
        letterSpacing={0.5}
        whiteSpace="nowrap"
        aria-live="polite"
        role="status"
        fontFamily="monospace" // ドラクエ風フォント
        textShadow="1px 1px 0px #000" // ドラクエ風テキストシャドウ
        bg="rgba(8,9,15,0.8)" // ドラクエ風リッチブラック背景
        border="2px solid rgba(255,255,255,0.9)" // ドラクエ風ボーダー
        borderRadius={0} // 角ばったデザイン
      >
        ✨ クリア!
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
        color="white" // ドラクエ風統一白文字
        letterSpacing={1} // やや控えめに
        // ドラクエ風ボーダー統一
        border="3px solid"
        borderColor="rgba(255,255,255,0.9)" // メインメニューと同じ白ボーダー
        borderRadius={0} // ドラクエ風角ばった
        transform="scale(1)"
        opacity={1}
        animation={failed ? "shakeFailure 0.6s ease-out" : "successPulse 1.2s ease-out"}
        css={{
          // ドラクエ風統一リッチブラック背景
          background: "rgba(8,9,15,0.95)", // メインメニューと同じ
          // ドラクエ風統一シャドウ
          boxShadow: "inset 0 3px 0 rgba(255,255,255,0.08), inset 0 -3px 0 rgba(0,0,0,0.4), 0 12px 24px rgba(0,0,0,0.5)", // メインメニューと同じ立体感
          backdropFilter: "blur(12px) saturate(1.2)", // メインメニューと同じ
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
        {failed ? "💥 しっぱい!" : "✨ クリア! ✨"} {/* ドラクエ風日本語 */}
        <Text
          fontSize={{ base: "md", md: "lg" }}
          mt={2}
          opacity={0.9}
          fontFamily="monospace" // ドラクエ風フォント統一
          fontWeight={500}
          letterSpacing="0.5px"
          textShadow="1px 1px 0px #000" // ドラクエ風テキストシャドウ
        >
          {failed ? "もういちど ちょうせんしよう!" : "みごとな じゅんばんでした!"} {/* ドラクエ風メッセージ */}
        </Text>
      </Box>
    </Box>
  );
}
