"use client";
import { Panel } from "@/components/ui/Panel";
import type { PlayerDoc } from "@/lib/types";
import { HStack, Stack, Text } from "@chakra-ui/react";

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
              <HStack
                key={p.id}
                justify="space-between"
                p={2}
                borderWidth="1px"
                rounded="md"
              >
                <Text>
                  #{idx + 1} {p.name}
                </Text>
                <Text
                  color="gray.200"
                  flex={1}
                  textAlign="center"
                  lineClamp={1}
                >
                  連想: {p.clue1 || "（未設定）"}
                </Text>
                <Text fontWeight="bold" color="yellow.300">
                  {p.number ?? "?"}
                </Text>
              </HStack>
            ))}
          </Stack>
        )}
      </Stack>
    </Panel>
  );
}
