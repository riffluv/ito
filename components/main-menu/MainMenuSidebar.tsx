"use client";

import { SupporterCTA } from "@/components/site/SupporterCTA";
import { AppButton } from "@/components/ui/AppButton";
import { Box, GridItem, HStack, Image, Text, VStack } from "@chakra-ui/react";

type MainMenuSidebarProps = {
  onRunLoadingTest: () => void | Promise<void>;
};

export function MainMenuSidebar(props: MainMenuSidebarProps) {
  const { onRunLoadingTest } = props;

  return (
    <GridItem display={{ base: "none", md: "block" }}>
      <VStack gap={6} align="stretch">
        <Box
          bg="rgba(20,16,12,0.85)"
          border="4px solid"
          borderColor="rgba(139,92,46,0.9)"
          borderRadius={0}
          p={5}
          boxShadow="3px 3px 0 rgba(0,0,0,0.9), 5px 5px 0 rgba(0,0,0,0.7), inset 0 2px 0 rgba(255,235,205,0.15)"
          position="relative"
          css={{
            background:
              "linear-gradient(135deg, rgba(28,22,16,0.92) 0%, rgba(18,14,10,0.88) 100%)",
            borderImage:
              "linear-gradient(to bottom, rgba(180,130,70,0.95), rgba(120,80,40,0.85)) 1",
          }}
        >
          <VStack gap={4} align="stretch">
            <HStack
              gap={4}
              align="center"
              pb={2}
              borderBottom="2px solid rgba(139,92,46,0.5)"
            >
              <Box
                w={12}
                h={12}
                borderRadius={0}
                bg="rgba(139,92,46,0.3)"
                border="3px solid rgba(214,177,117,0.7)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                boxShadow="2px 2px 0 rgba(0,0,0,0.7), inset 1px 1px 0 rgba(255,235,205,0.3)"
              >
                <Image
                  src="/images/hanepen1.webp"
                  alt="羽ペン"
                  w="24px"
                  h="24px"
                  filter="brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,0.6))"
                />
              </Box>
              <Text
                fontWeight={700}
                fontSize="xl"
                color="rgba(255,235,205,0.98)"
                fontFamily="monospace"
                textShadow="2px 2px 0px rgba(0,0,0,0.9), 0 0 8px rgba(255,235,205,0.3)"
                letterSpacing="1px"
              >
                開発者より
              </Text>
            </HStack>

            <VStack gap={4} align="stretch">
              <Box
                p={4}
                bg="rgba(245,235,215,0.12)"
                border="2px solid rgba(214,177,117,0.4)"
                borderRadius={0}
                boxShadow="inset 0 1px 0 rgba(255,245,220,0.2), 1px 1px 0 rgba(0,0,0,0.5)"
                css={{
                  background:
                    "linear-gradient(to bottom, rgba(245,235,215,0.15), rgba(235,225,205,0.08))",
                }}
              >
                <VStack gap={2} align="start">
                  <HStack gap={2} align="center">
                    <Text
                      fontSize="md"
                      fontWeight={700}
                      color="rgba(255,215,0,0.95)"
                      fontFamily="monospace"
                      textShadow="1px 1px 0px #000"
                    >
                      🎮
                    </Text>
                    <Text
                      fontSize="md"
                      fontWeight={700}
                      color="rgba(255,235,205,0.95)"
                      fontFamily="monospace"
                      textShadow="1px 1px 0px #000"
                    >
                      このゲームについて
                    </Text>
                  </HStack>
                  <Text
                    fontSize="xs"
                    color="rgba(255,255,255,0.92)"
                    fontFamily="monospace"
                    lineHeight="1.7"
                    textShadow="1px 1px 0px rgba(0,0,0,0.8)"
                  >
                    &quot;連想ワードだけで数字の大小をそろえる&quot;という発想を、オンライン協力向けに再構成しています。共同編集・カード演出・リアルタイム同期の臨場感を目指して日々改善中です。
                  </Text>
                </VStack>
              </Box>

              <Box
                p={4}
                bg="rgba(34,197,94,0.1)"
                border="2px solid rgba(34,197,94,0.5)"
                borderLeft="4px solid rgba(34,197,94,0.8)"
                borderRadius={0}
                boxShadow="inset 0 1px 0 rgba(34,197,94,0.2), 1px 1px 0 rgba(0,0,0,0.5)"
              >
                <VStack gap={2} align="start">
                  <HStack gap={2} align="center">
                    <Text
                      fontSize="md"
                      fontWeight={700}
                      color="rgba(34,197,94,0.95)"
                      fontFamily="monospace"
                      textShadow="1px 1px 0px #000"
                    >
                      ⚠️
                    </Text>
                    <Text
                      fontSize="md"
                      fontWeight={700}
                      color="rgba(100,255,150,0.98)"
                      fontFamily="monospace"
                      textShadow="1px 1px 0px #000"
                    >
                      注意事項
                    </Text>
                  </HStack>
                  <Text
                    fontSize="xs"
                    color="rgba(255,255,255,0.92)"
                    fontFamily="monospace"
                    lineHeight="1.7"
                    textShadow="1px 1px 0px rgba(0,0,0,0.8)"
                  >
                    ブラウザだけで遊べる完全オリジナル作品です。同期実験中のため、不具合を見つけたら気軽に知らせてください。
                  </Text>
                </VStack>
              </Box>

              <Box
                p={4}
                bg="rgba(147,51,234,0.1)"
                border="2px solid rgba(147,51,234,0.5)"
                borderLeft="4px solid rgba(147,51,234,0.8)"
                borderRadius={0}
                boxShadow="inset 0 1px 0 rgba(147,51,234,0.2), 1px 1px 0 rgba(0,0,0,0.5)"
              >
                <VStack gap={2} align="start">
                  <HStack gap={2} align="center">
                    <Text
                      fontSize="md"
                      fontWeight={700}
                      color="rgba(147,51,234,0.95)"
                      fontFamily="monospace"
                      textShadow="1px 1px 0px #000"
                    >
                      💎
                    </Text>
                    <Text
                      fontSize="md"
                      fontWeight={700}
                      color="rgba(180,120,255,0.98)"
                      fontFamily="monospace"
                      textShadow="1px 1px 0px #000"
                    >
                      今後の予定
                    </Text>
                  </HStack>
                  <VStack gap={1.5} align="start" pl={2}>
                    <Text
                      fontSize="xs"
                      color="rgba(255,255,255,0.92)"
                      fontFamily="monospace"
                      lineHeight="1.7"
                      textShadow="1px 1px 0px rgba(0,0,0,0.8)"
                    >
                      ・ちゃんと寝る
                    </Text>
                    <Text
                      fontSize="xs"
                      color="rgba(255,255,255,0.92)"
                      fontFamily="monospace"
                      lineHeight="1.7"
                      textShadow="1px 1px 0px rgba(0,0,0,0.8)"
                    >
                      ・コーヒーを控える（最重要）
                    </Text>
                  </VStack>
                </VStack>
              </Box>
            </VStack>
          </VStack>
        </Box>

        <SupporterCTA />

        <Box mt={4} pt={4} borderTop="1px solid rgba(255,255,255,0.2)">
          <Text
            fontSize="sm"
            color="white"
            fontFamily="monospace"
            fontWeight={600}
            mb={2}
          >
            🛠️ 開発テスト
          </Text>
          <AppButton
            size="sm"
            visual="outline"
            palette="gray"
            onClick={onRunLoadingTest}
            css={{
              width: "100%",
              fontSize: "xs",
              fontFamily: "monospace",
              height: "28px",
            }}
          >
            ローディングテスト
          </AppButton>
        </Box>
      </VStack>
    </GridItem>
  );
}

