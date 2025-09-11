"use client";
import { Panel } from "@/components/ui/Panel";
import type { PlayerDoc } from "@/lib/types";
import { Box, Stack, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";

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
          <Text color={UI_TOKENS.COLORS.whiteAlpha60}>データがありません</Text>
        ) : (
          <Stack>
            {played.map((p, idx) => (
              <Box
                key={p.id}
                p={3}
                borderRadius="8px"
                bg={UI_TOKENS.COLORS.panelBg}
                border={`1px solid ${UI_TOKENS.COLORS.whiteAlpha30}`}
                boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
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
                  color={UI_TOKENS.COLORS.textBase}
                  fontWeight={600}
                  textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
                >
                  #{idx + 1} {p.name}
                </Text>
                <Text
                  textAlign="center"
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
                  color={UI_TOKENS.COLORS.textMuted}
                >
                  連想: {p.clue1 || "（未設定）"}
                </Text>
                <Text
                  fontWeight="bold"
                  color="#FFD700"
                  textAlign="right"
                  textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
                  fontSize="lg"
                >
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
