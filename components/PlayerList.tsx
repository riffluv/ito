"use client";
import type { PlayerDoc } from "@/lib/types";
import { Avatar, Badge, HStack, Stack, Text } from "@chakra-ui/react";
// presence が取得できなくても、一覧は常に全員表示する方針

// ロビー体験をシンプルにするため、常に全員を表示。
// presence があればバッジでオンラインを示すが、フィルタはしない。
export function PlayerList({
  players,
  online,
  myId,
}: {
  players: (PlayerDoc & { id: string })[];
  online?: string[] | undefined;
  myId?: string | null;
}) {
  const onlineSet = Array.isArray(online) ? new Set(online) : null;
  const visible = players;
  return (
    <Stack spacing={2}>
      {visible.map((p) => {
        const isMe = myId && p.uid ? myId === p.uid : myId === p.id;
        return (
          <HStack
            key={p.id}
            p={3}
            borderWidth="1px"
            rounded="xl"
            bg={isMe ? "#141C2E" : "panelSubBg"}
            borderColor="borderDefault"
            justify="space-between"
            align="flex-start"
          >
            <HStack align="flex-start" spacing={3} flex="1">
              <Avatar name={p.name} title={p.avatar} />
              <Stack spacing={0} maxW="full" flex="1">
                <HStack spacing={2} align="center" flex="1">
                  <Text fontWeight="semibold" flexShrink={0}>
                    {p.name}
                  </Text>
                  {/* 自分だけ自分に配られた数字を見られるようにする（他人の数字は表示しない） */}
                  {isMe && typeof p.number === "number" && (
                    <Badge colorScheme="green" title="あなたの数字">
                      <Text as="span" textStyle="numeric">#{p.number}</Text>
                    </Badge>
                  )}
                </HStack>
                <Text
                  fontSize="sm"
                  color="fgMuted"
                  noOfLines={2}
                  overflowWrap="anywhere"
                >
                  連想ワード: {p.clue1 ? p.clue1 : "（未設定）"}
                </Text>
              </Stack>
            </HStack>
            <HStack>
              {p.ready && <Badge colorScheme="blue">準備OK</Badge>}
            </HStack>
          </HStack>
        );
      })}
      {visible.length === 0 && (
        <Text fontSize="sm" color="gray.400">
          プレイヤーがいません
        </Text>
      )}
    </Stack>
  );
}
