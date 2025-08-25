"use client";
import { Panel } from "@/components/ui/Panel";
import type { RoomDoc } from "@/lib/types";
import { Box, Text } from "@chakra-ui/react";

export function TopicDisplay({
  room,
  inline = false,
}: {
  room: RoomDoc & { id?: string };
  inline?: boolean;
}) {
  const hasTopic = !!room.topic;
  const topicBox = (room as any).topicBox as string | null | undefined;

  // 表示専用: 固定高さで完全にCLS防止
  const content = (
    <Box
      minH="80px"
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Box w="full" textAlign="center">
        {hasTopic ? (
          <>
            <Text fontWeight="bold" fontSize="lg" mb={1}>
              {room.topic}
            </Text>
            {topicBox && (
              <Text color="gray.300" fontSize="sm">
                カテゴリ: {topicBox}
              </Text>
            )}
          </>
        ) : (
          <Text color="gray.300">
            お題が設定されていません
          </Text>
        )}
      </Box>
    </Box>
  );

  if (inline) {
    return <Box>{content}</Box>;
  }

  return <Panel title="お題">{content}</Panel>;
}