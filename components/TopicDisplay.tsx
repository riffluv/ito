"use client";
import { Panel } from "@/components/ui/Panel";
import type { RoomDoc } from "@/lib/types";
import { Box, Text } from "@chakra-ui/react";
import { UI_TOKENS } from "@/theme/layout";

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
              color={UI_TOKENS.COLORS.textBase}
              textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
            >
              {room.topic}
            </Text>
          </>
        ) : (
          <Text
            color={UI_TOKENS.COLORS.textMuted}
            textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
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
