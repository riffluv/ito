"use client";
import { Box, HStack, Link, Stack, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";
import NextLink from "next/link";

export default function LobbyRightRail() {
  return (
    <Box as="aside" position="sticky" top="80px">
      {/* はじめての方へ */}
      <Box
        css={{
          background: UI_TOKENS.COLORS.panelBg,
          border: `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
          borderRadius: 0,
          padding: "16px",
          boxShadow: UI_TOKENS.SHADOWS.panelDistinct,
          position: "relative",
        }}
      >
        <Stack gap={4} position="relative">
          <HStack gap={3} align="center">
            <Box
              w={8}
              h={8}
              bg={UI_TOKENS.COLORS.whiteAlpha10}
              borderRadius={0}
              border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`}
              display="flex"
              alignItems="center"
              justifyContent="center"
              css={{
                boxShadow: UI_TOKENS.SHADOWS.panelSubtle
              }}
            >
              <Text fontSize="17px" color="white" fontFamily="monospace" fontWeight={700}>
                ?
              </Text>
            </Box>
            <Text
              fontWeight={600}
              fontSize="sm"
              color="white"
              fontFamily="monospace"
              textShadow="1px 1px 0px #000"
              letterSpacing="0.5px"
            >
              ▼ はじめての方へ ▼
            </Text>
          </HStack>

          <Text
            color={UI_TOKENS.COLORS.textMuted}
            fontSize="xs"
            lineHeight={1.6}
            fontFamily="monospace"
          >
            1. 部屋を作成または参加します
            <br />
            2. お題に沿って数字の大小感で並べ替え
            <br />
            3. 全員の認識を合わせましょう
          </Text>

          <Link
            as={NextLink}
            href="/rules"
            color="white"
            fontSize="xs"
            fontWeight={600}
            fontFamily="monospace"
            textDecoration="none"
            textShadow="1px 1px 0px #000"
            _hover={{
              color: UI_TOKENS.COLORS.whiteAlpha80,
              textDecoration: "underline",
            }}
          >
            ルールを詳しく見る →
          </Link>
        </Stack>
      </Box>

      {/* アップデート情報 */}
      <Box
        mt={4}
        css={{
          background: UI_TOKENS.COLORS.panelBg,
          border: `3px solid ${UI_TOKENS.COLORS.whiteAlpha90}`,
          borderRadius: 0,
          padding: "16px",
          boxShadow: UI_TOKENS.SHADOWS.panelDistinct,
          position: "relative",
        }}
      >
        <Stack gap={4} position="relative">
          <HStack gap={3} align="center">
            <Box
              w={8}
              h={8}
              bg={UI_TOKENS.COLORS.whiteAlpha10}
              borderRadius={0}
              border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`}
              display="flex"
              alignItems="center"
              justifyContent="center"
              css={{
                boxShadow: UI_TOKENS.SHADOWS.panelSubtle
              }}
            >
              <Text fontSize="17px" color="white" fontFamily="monospace" fontWeight={700}>
                !
              </Text>
            </Box>
            <Text
              fontWeight={600}
              fontSize="sm"
              color="white"
              fontFamily="monospace"
              textShadow="1px 1px 0px #000"
              letterSpacing="0.5px"
            >
              ▼ アップデート情報 ▼
            </Text>
          </HStack>

          <Text
            color={UI_TOKENS.COLORS.textMuted}
            fontSize="xs"
            lineHeight={1.6}
            fontFamily="monospace"
          >
            ドラクエ風のUIに統一したよ。
            <br />
            細部までこだわって作った！
          </Text>

          <Box
            p={2}
            bg={UI_TOKENS.COLORS.whiteAlpha10}
            border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha30}`}
            borderRadius={0}
            fontSize="xs"
            color="white"
            fontWeight={600}
            textAlign="center"
            fontFamily="monospace"
            textShadow="1px 1px 0px #000"
            css={{
              boxShadow: UI_TOKENS.SHADOWS.panelSubtle
            }}
          >
            v2.0 - ドラクエ風統一完了
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
