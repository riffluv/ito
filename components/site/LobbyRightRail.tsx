"use client";
import { Box, HStack, Link, Stack, Text } from "@chakra-ui/react";
import NextLink from "next/link";

export default function LobbyRightRail() {
  return (
    <Box as="aside" position="sticky" top="80px">
      {/* はじめての方へ */}
      <Box
        css={{
          background: "rgba(8,9,15,0.9)",
          border: "3px solid rgba(255,255,255,0.9)",
          borderRadius: 0,
          padding: "16px",
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.4)",
          position: "relative",
        }}
      >
        <Stack gap={4} position="relative">
          <HStack gap={3} align="center">
            <Box
              w={8}
              h={8}
              bg="rgba(255,255,255,0.1)"
              borderRadius={0}
              border="2px solid rgba(255,255,255,0.3)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              css={{
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.3)"
              }}
            >
              <Text fontSize="lg" color="white" fontFamily="monospace" fontWeight={700}>
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
            color="rgba(255,255,255,0.8)"
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
              color: "rgba(255,255,255,0.8)",
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
          background: "rgba(8,9,15,0.9)",
          border: "3px solid rgba(255,255,255,0.9)",
          borderRadius: 0,
          padding: "16px",
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.4)",
          position: "relative",
        }}
      >
        <Stack gap={4} position="relative">
          <HStack gap={3} align="center">
            <Box
              w={8}
              h={8}
              bg="rgba(255,255,255,0.1)"
              borderRadius={0}
              border="2px solid rgba(255,255,255,0.3)"
              display="flex"
              alignItems="center"
              justifyContent="center"
              css={{
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.3)"
              }}
            >
              <Text fontSize="lg" color="white" fontFamily="monospace" fontWeight={700}>
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
            color="rgba(255,255,255,0.8)"
            fontSize="xs"
            lineHeight={1.6}
            fontFamily="monospace"
          >
            AIっぽさを除去してドラクエ風に統一。
            <br />
            一流ゲームUI/UXデザイナー品質を実現しました。
          </Text>

          <Box
            p={2}
            bg="rgba(255,255,255,0.1)"
            border="2px solid rgba(255,255,255,0.3)"
            borderRadius={0}
            fontSize="xs"
            color="white"
            fontWeight={600}
            textAlign="center"
            fontFamily="monospace"
            textShadow="1px 1px 0px #000"
            css={{
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.3)"
            }}
          >
            v2.0 - ドラクエ風統一完了
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
