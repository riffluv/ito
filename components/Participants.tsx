"use client";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Avatar, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { CheckCircle2 } from "lucide-react";

export function Participants({
  players,
}: {
  players: (PlayerDoc & { id: string })[]; // derived participants only
}) {
  if (players.length === 0) {
    return (
      <Text fontSize="sm" color="fgMuted">
        誰もオンラインではありません
      </Text>
    );
  }
  return (
    <Stack as="ul" role="list" gap={2} pl={0} m={0} listStyleType="none">
      {players.map((p) => (
        <Box as="li" key={p.id}>
          {/* 
            最適化されたレイアウト:
            - パディング削減: p={1.5} (6px) に変更 
            - gap削減: gap={2} (8px) に変更
            - アイコンを視覚的インジケーターのみに変更
            - 名前エリアの幅を最大化
          */}
          <HStack
            gap={2}
            p={1.5}
            borderRadius="md"
            minH={12}
            align="center"
            boxShadow={UNIFIED_LAYOUT.ELEVATION.CARD.RAISED}
            bg={UNIFIED_LAYOUT.SURFACE.PANEL}
            _hover={{
              bg: "cardHoverBg",
              transform: "translateY(-1px)",
            }}
            transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
          >
            <Avatar.Root size="xs" flexShrink={0}>
              <Avatar.Fallback name={p.name} />
            </Avatar.Root>

            {/* 名前エリア - 最大幅を確保 */}
            <Box flex={1} minW={0} overflow="hidden">
              <HStack gap={1} align="center" minW={0}>
                <Text
                  fontWeight="semibold"
                  fontSize="sm"
                  title={p.name}
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  flex={1}
                  minW={0}
                >
                  {p.name}
                </Text>

                {/* コンパクトな在室インジケーター */}
                <CheckCircle2
                  size={12}
                  style={{
                    color: "#22C55E",
                    flexShrink: 0,
                    opacity: 0.8,
                  }}
                />
              </HStack>

              {/* 連想ワード - 2行目 */}
              {p.clue1 && (
                <Text
                  fontSize="xs"
                  color="fgMuted"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  title={`連想: ${p.clue1}`}
                  mt={0.5}
                >
                  連想: {p.clue1}
                </Text>
              )}
            </Box>
          </HStack>
        </Box>
      ))}
    </Stack>
  );
}
