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
      pt={{ base: 12, md: 16 }}
      pb={{ base: 12, md: 16 }}
      bg="white" // ゲーム画面と統一した白背景
      borderBottom="1px solid #e2e8f0" // --slate-200 (ゲーム画面と統一)
      boxShadow="0 1px 3px 0 rgb(0 0 0 / 0.1)" // ゲーム画面と統一したshadow
    >
      <Container maxW="6xl" position="relative">
        {/* プロフェッショナルなゲーム風ヒーローセクション */}
        <Box
          bg="white"
          border="1px solid #e5e7eb" // より自然なグレー
          borderRadius="12px" // 微妙に異なる角丸
          padding={{ base: "1.75rem", md: "2.5rem" }} // 非均等なパディング
          boxShadow="0 2px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" // より控えめなシャドウ
          position="relative"
        >
          {/* カードゲーム風のヘッダーデザイン */}
          <Box textAlign="center" mb="8">
            <Text
              fontSize={{ base: "2xl", md: "3xl", lg: "4xl" }} // より控えめなサイズ
              fontWeight={600} // 少し軽く
              color="#111827" // --gray-900 より自然
              fontFamily="system-ui, -apple-system, sans-serif" // シンプルなフォント
              letterSpacing="-0.025em" // 微妙な調整
              mb="3"
            >
              ITO
            </Text>
            <Text
              fontSize={{ base: "md", md: "lg" }} // 控えめサイズ
              color="#6b7280" // --gray-500 より自然
              maxW="480px" // 少し狭く
              mx="auto"
              lineHeight="1.5" // より標準的
            >
              協力型カードゲーム　数字を使わずに順番を見つけよう
            </Text>
          </Box>

          {/* アクションボタンエリア - 自然な間隔とホバー */}
          <HStack justify="center" gap={{ base: "4", md: "8" }} flexWrap="wrap">
            <AppButton
              visual="soft"
              palette="orange"
              size="lg"
              onClick={onPlay}
              minW={{ base: "10rem", md: "13rem" }}
              height="3.25rem"
              fontSize="md"
              fontWeight={500}
              _hover={{
                opacity: 0.9,
              }}
              transition="opacity 0.15s ease"
            >
              今すぐプレイ
            </AppButton>
            <AppButton
              size="lg"
              variant="outline"
              onClick={onRules}
              minW={{ base: "9rem", md: "11rem" }}
              height="3.25rem"
              fontSize="md"
              fontWeight={400}
              borderColor="#d1d5db" // --gray-300 より自然
              color="#374151" // --gray-700 より読みやすく
              _hover={{
                bg: "#f9fafb", // --gray-50 より微妙
                borderColor: "#9ca3af", // --gray-400
              }}
              transition="all 0.12s ease"
            >
              ルールを確認
            </AppButton>
          </HStack>

        </Box>
      </Container>

    </Box>
  );
}
