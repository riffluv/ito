"use client";
import { Avatar, Badge, Box, HStack, Stack, Text, Tooltip } from "@chakra-ui/react";
import type { PlayerDoc } from "@/lib/types";

export function PlayerList({ players }: { players: (PlayerDoc & { id: string })[] }) {
  return (
    <Stack spacing={2}>
      {players.map((p) => (
        <HStack key={p.id} p={2} borderWidth="1px" rounded="md" bg="blackAlpha.300" justify="space-between">
          <HStack>
            <Avatar name={p.name} title={p.avatar} />
            <Text>{p.name}</Text>
          </HStack>
          <HStack>
            <Tooltip label={p.clue1 ? `ヒント1: ${p.clue1}` : "ヒント1未入力"}>
              <Badge colorScheme={p.clue1 ? "green" : "gray"}>H1</Badge>
            </Tooltip>
            <Tooltip label={p.clue2 ? `ヒント2: ${p.clue2}` : "ヒント2なし"}>
              <Badge colorScheme={p.clue2 ? "purple" : "gray"}>H2</Badge>
            </Tooltip>
            {p.ready && <Badge colorScheme="blue">確認済</Badge>}
          </HStack>
        </HStack>
      ))}
    </Stack>
  );
}

