"use client";
import type { PlayerDoc } from "@/lib/types";
import { Avatar, Badge, HStack, List, Stack, Text } from "@chakra-ui/react";

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
    <List.Root gap="2">
      {players.map((p) => (
        <List.Item key={p.id}>
          <HStack gap={3} p={2} borderWidth="1px" borderRadius="lg">
            <Avatar.Root size="sm">
              <Avatar.Fallback name={p.name} />
            </Avatar.Root>
            <Stack gap={0} flex={1} minW={0}>
              <Text fontWeight="semibold" lineClamp={1}>
                {p.name}
              </Text>
              {p.clue1 && (
                <Text fontSize="xs" color="fgMuted" lineClamp={1}>
                  連想: {p.clue1}
                </Text>
              )}
            </Stack>
            <Badge colorPalette="green">在室</Badge>
          </HStack>
        </List.Item>
      ))}
    </List.Root>
  );
}
