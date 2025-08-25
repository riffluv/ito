"use client";
import { Panel } from "@/components/ui/Panel";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Stack, Text } from "@chakra-ui/react";

export function ResultPanel({
  players,
  orderList,
  title = "出した順（連想と数字）",
}: {
  players: (PlayerDoc & { id: string })[];
  orderList: string[];
  title?: string;
}) {
  const played = orderList
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as (PlayerDoc & { id: string })[];

  return (
    <Panel title={title}>
      <Stack>
        {played.length === 0 ? (
          <Text color="gray.400">データがありません</Text>
        ) : (
          <Stack>
            {played.map((p, idx) => (
              <Box
                key={p.id}
                p={2}
                rounded="md"
                bg="panelSubBg"
                boxShadow={UNIFIED_LAYOUT.ELEVATION.CARD.RAISED}
                display="grid"
                gridTemplateColumns={{
                  base: "1fr 1fr auto",
                  md: "200px 1fr 72px",
                }}
                alignItems="center"
                gap={3}
              >
                <Text
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                >
                  #{idx + 1} {p.name}
                </Text>
                <Text
                  color="gray.200"
                  textAlign="center"
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                >
                  連想: {p.clue1 || "（未設定）"}
                </Text>
                <Text fontWeight="bold" color="yellow.300" textAlign="right">
                  {p.number ?? "?"}
                </Text>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>
    </Panel>
  );
}
