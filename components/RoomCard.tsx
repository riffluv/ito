"use client";
import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { Panel } from "@/components/ui/Panel";

export function RoomCard({
  name,
  status,
  count,
  onJoin,
}: {
  name: string;
  status: string;
  count: number;
  onJoin: () => void;
}) {
  const statusLabel = count === 0 ? "待機中" : (status === "waiting" ? "待機中" : "ゲーム中");
  return (
    <Panel>
      <Stack>
        <Text fontWeight="bold" fontSize="lg">{name}</Text>
        <HStack justify="space-between">
          <Text fontSize="sm" color="gray.300">状態: {statusLabel}</Text>
          <Text fontSize="sm" color="gray.300">人数: {count}人</Text>
        </HStack>
        <Button colorScheme="blue" onClick={onJoin} aria-label={`${name}に参加`}>
          参加
        </Button>
      </Stack>
    </Panel>
  );
}
