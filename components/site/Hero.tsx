"use client";
import { AppButton } from "@/components/ui/AppButton";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Container, HStack, Text } from "@chakra-ui/react";

type Props = {
  onPlay?: () => void;
  onRules?: () => void;
};

export default function Hero({ onPlay, onRules }: Props) {
  return (
    <Box
      position="relative"
      overflow="hidden"
      pt={{ base: 16, md: 20 }}
      pb={{ base: 16, md: 20 }}
      bgGradient="radial-gradient(ellipse 120% 80% at 50% 0%, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0.08) 25%, {colors.surfaceBase} 60%)"
      _before={{
        content: '""',
        position: 'absolute',
        inset: 0,
        bgGradient: 'linear-gradient(135deg, rgba(99,102,241,0.03) 0%, transparent 40%, rgba(139,92,246,0.02) 100%)',
        pointerEvents: 'none'
      }}
    >
      <Container maxW="5xl" position="relative">
        {/* プロフェッショナルなゲーム風ヒーローセクション */}
        <Box
          bg="{colors.surfaceRaised}"
          border="1px solid {colors.borderStrong}"
          borderRadius="16px"
          padding={{ base: "2rem", md: "2.5rem", lg: "3rem" }}
          maxW="800px"
          mx="auto"
          boxShadow="0 8px 32px -8px rgba(0,0,0,0.3), 0 4px 16px -4px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)"
          position="relative"
          _before={{
            content: '""',
            position: 'absolute',
            inset: 0,
            borderRadius: '16px',
            padding: '1px',
            bg: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, transparent 50%, rgba(139,92,246,0.1) 100%)',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'xor',
            WebkitMaskComposite: 'xor'
          }}
        >
          {/* カードゲーム風のヘッダーデザイン */}
          <Box textAlign="center" mb="8">
            <Text
              fontSize={{ base: "3xl", md: "4xl", lg: "5xl" }}
              fontWeight={700}
              color="{colors.fgDefault}"
              fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif"
              letterSpacing="-0.03em"
              mb="4"
              bgGradient="linear-gradient(135deg, {colors.fgDefault} 0%, rgba(99,102,241,0.8) 100%)"
              bgClip="text"
              textShadow="0 2px 8px rgba(99,102,241,0.3)"
            >
              ITO
            </Text>
            <Text
              fontSize={{ base: "lg", md: "xl" }}
              color="{colors.fgMuted}"
              maxW="520px"
              mx="auto"
              lineHeight="1.6"
              fontWeight={400}
              letterSpacing="-0.01em"
            >
              協力型カードゲーム　数字を使わずに順番を見つけよう
            </Text>
          </Box>

          {/* アクションボタンエリア - 自然な間隔とホバー */}
          <HStack justify="center" gap={{ base: "4", md: "6" }} flexWrap="wrap" mt="10">
            <AppButton
              visual="solid"
              palette="brand"
              size="lg"
              onClick={onPlay}
              minW={{ base: "9rem", md: "11rem" }}
              height="3rem"
              fontSize="md"
              fontWeight={500}
              borderRadius="8px"
              letterSpacing="-0.01em"
              px={8}
              py={3}
              css={{
                background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
                border: "none",
                color: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)",
                transition: "all 0.15s ease",
                _hover: {
                  background: "linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)",
                  transform: "translateY(-1px)",
                  boxShadow: "0 4px 12px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.15)"
                },
                _active: {
                  transform: "translateY(0) scale(0.98)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.2), inset 0 1px 3px rgba(0,0,0,0.1)"
                }
              }}
            >
              今すぐプレイ
            </AppButton>
            <AppButton
              size="lg"
              visual="ghost"
              onClick={onRules}
              minW={{ base: "8rem", md: "10rem" }}
              height="3rem"
              fontSize="md"
              fontWeight={400}
              borderRadius="8px"
              letterSpacing="-0.01em"
              px={8}
              py={3}
              css={{
                color: "{colors.fgMuted}",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "transparent",
                transition: "all 0.15s ease",
                _hover: {
                  color: "{colors.fgDefault}",
                  borderColor: "rgba(255,255,255,0.2)",
                  background: "rgba(255,255,255,0.05)",
                  transform: "translateY(-1px)"
                },
                _active: {
                  transform: "translateY(0) scale(0.98)",
                  background: "rgba(255,255,255,0.03)"
                }
              }}
            >
              ルールを確認
            </AppButton>
          </HStack>

        </Box>
      </Container>

    </Box>
  );
}
