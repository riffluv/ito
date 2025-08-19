"use client";
import { Avatar, Badge, HStack, Stack, Text } from "@chakra-ui/react";
import type { PlayerDoc } from "@/lib/types";

// ロビー体験をシンプルにするため、常に全員を表示。
// presence があればバッジでオンラインを示すが、フィルタはしない。
export function PlayerList({ players, online }: { players: (PlayerDoc & { id: string })[]; online?: string[] | undefined }) {
  const onlineSet = Array.isArray(online) ? new Set(online) : null;
  return (
    <Stack spacing={2}>
      {players.map((p) => (
        <HStack key={p.id} p={3} borderWidth="1px" rounded="md" bg="blackAlpha.300" justify="space-between" align="flex-start">
          <HStack align="flex-start" spacing={3} maxW="70%">
            <Avatar name={p.name} title={p.avatar} />
            <Stack spacing={0} maxW="full">
              <Text fontWeight="semibold" isTruncated>{p.name}</Text>
              <Text fontSize="sm" color="gray.300" noOfLines={2}>
                連想ワード: {p.clue1 ? p.clue1 : "（未設定）"}
              </Text>
            </Stack>
          </HStack>
          <HStack>
            {onlineSet && onlineSet.has(p.id) && <Badge colorScheme="green">オンライン</Badge>}
            {p.ready && <Badge colorScheme="blue">確認済</Badge>}
          </HStack>
        </HStack>
      ))}
      {players.length === 0 && (
        <Text fontSize="sm" color="gray.400">プレイヤーがいません</Text>
      )}
    </Stack>
  );
}
