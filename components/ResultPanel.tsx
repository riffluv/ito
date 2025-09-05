"use client";
import { Panel } from "@/components/ui/Panel";
import type { PlayerDoc } from "@/lib/types";
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
          <Text color="rgba(255,255,255,0.6)">データがありません</Text>
        ) : (
          <Stack>
            {played.map((p, idx) => (
              <Box
                key={p.id}
                p={3}
                borderRadius="8px"
                bg="rgba(15,15,35,0.8)"
                border="1px solid rgba(255,255,255,0.3)"
                boxShadow="inset 0 1px 2px rgba(255,255,255,0.1), 0 4px 8px rgba(0,0,0,0.3)"
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
                  color="rgba(255,255,255,0.95)"
                  fontWeight={600}
                  textShadow="0 1px 2px rgba(0,0,0,0.5)"
                >
                  #{idx + 1} {p.name}
                </Text>
                <Text
                  color="rgba(255,255,255,0.7)"
                  textAlign="center"
                  whiteSpace="nowrap"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  textShadow="0 1px 2px rgba(0,0,0,0.5)"
                >
                  連想: {p.clue1 || "（未設定）"}
                </Text>
                <Text
                  fontWeight="bold"
                  color="#FFD700"
                  textAlign="right"
                  textShadow="0 1px 2px rgba(0,0,0,0.7)"
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
