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
            最適化されたレイアウト + CLS回避:
            - パディング削減: p={1.5} (6px) に変更 
            - gap削減: gap={2} (8px) に変更
            - アイコンを視覚的インジケーターのみに変更
            - 名前エリアの幅を最大化
            - 連想ワードの有無に関わらず固定高さでCLS防止
          */}
          <HStack
            gap={2}
            p={1.5}
            borderRadius="md"
            h={16} /* minH → h で固定高さ化 (連想ワード用スペース確保) */
            align="stretch" /* 内部要素を全高さに引き伸ばし */
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

            {/* 名前エリア - 最大幅を確保 + 高さ全体を使用 */}
            <Box
              flex={1}
              minW={0}
              overflow="hidden"
              h="100%"
              display="flex"
              flexDir="column"
              justifyContent="center"
            >
              <Box>
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

                {/* 連想ワード - 常に同じスペースを確保してCLS防止 */}
                <Box minH="16px" mt={0.5}>
                  {p.clue1 ? (
                    <Text
                      fontSize="xs"
                      color="fgMuted"
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                      title={`連想: ${p.clue1}`}
                    >
                      連想: {p.clue1}
                    </Text>
                  ) : (
                    /* 連想ワードがない場合も同じ高さを維持 */
                    <Box />
                  )}
                </Box>
              </Box>
            </Box>
          </HStack>
        </Box>
      ))}
    </Stack>
  );
}
