"use client";
import { TopicDisplay } from "@/components/TopicDisplay";
import { Panel } from "@/components/ui/Panel";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, HStack, Text } from "@chakra-ui/react";

export default function UniversalMonitor({
  room,
  players,
}: {
  room: RoomDoc | null;
  players: (PlayerDoc & { id: string })[];
}) {
  if (!room) return null;

  return (
    <Panel
      minH={
        UNIFIED_LAYOUT.MONITOR_MIN_HEIGHT
      } /* コンパクト化：統一システム対応 */
      display="flex"
      flexDir="column"
      justifyContent="flex-start"
      density="compact"
      p={4} /* 統一スペーシング：UNIFIED_LAYOUT.SPACING.COMPONENT_PADDING相当 */
      overflow="hidden"
    >
      {/* top banner */}
      <Box
        bgGradient="linear(90deg,#ff9a58,#ffcf67)"
        px={4}
        py={2}
        roundedTopLeft={8}
        roundedTopRight={8}
        color="panelBannerFg"
        fontWeight={700}
        fontSize="sm"
      >
        ラウンド {room?.round ?? 1} | カテゴリ:{" "}
        {(room as any)?.topicBox ?? "未選択"}
      </Box>

      <Box
        px={5}
        py={3}
        textAlign="center"
        minH="120px"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Box w="full">
          <TopicDisplay room={room} inline />
        </Box>
      </Box>

      {room.status === "finished" && (
        <Box mt={3}>
          <HStack justifyContent="center">
            <Text
              fontWeight="bold"
              fontSize={{ base: "xl", md: "3xl" }}
              color={room.result?.success ? "green.300" : "red.300"}
            >
              {room.result?.success ? "クリア！" : "失敗です！！"}
            </Text>
          </HStack>
        </Box>
      )}
    </Panel>
  );
}
