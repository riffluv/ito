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
      // DPI差でスクロールが出ないよう固定最小高をやや低めに
      minH={{ base: "64px", md: "72px" }}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Box w="full" textAlign="center">
        {hasTopic ? (
          <>
            <Text
              fontWeight="bold"
              fontSize={{ base: "md", md: "lg" }}
              color="rgba(255,255,255,0.95)"
              textShadow="0 1px 2px rgba(0,0,0,0.5)"
            >
              {room.topic}
            </Text>
          </>
        ) : (
          <Text
            color="rgba(255,255,255,0.6)"
            textShadow="0 1px 2px rgba(0,0,0,0.5)"
          >
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
