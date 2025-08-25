"use client";
import { TopicDisplay } from "@/components/TopicDisplay";
import { Panel } from "@/components/ui/Panel";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, HStack, Text } from "@chakra-ui/react";

export default function UniversalMonitor({
  room,
  players,
  roomId,
  isHost,
}: {
  room: RoomDoc | null;
  players: (PlayerDoc & { id: string })[];
  roomId: string;
  isHost: boolean;
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

      <Box px={5} py={3} textAlign="center">
        {/* Show the topic selector only for the host during clue phase; when shown, hide the separate header text to avoid duplicate boxes */}
        {room.status === "clue" && isHost ? (
          <Box>
            <TopicDisplay roomId={roomId} room={room} isHost={isHost} inline />
            {/* Host primary controls can be added here if needed */}
          </Box>
        ) : (
          <>
            <Text
              fontSize={{ base: "lg", md: "2.25rem" }}
              fontWeight="800"
              color="accent"
            >
              {room.topic
                ? `お題：${room.topic}`
                : room.status === "waiting"
                  ? "ゲーム開始後にお題を選択できます"
                  : "お題が未設定です"}
            </Text>
            <Text fontSize="sm" color="fgMuted" mt={2}>
              {room.status === "clue" &&
                "カードを並べてください（ミスすると失敗）"}
              {room.status === "waiting" &&
                "ホストがゲームを開始するとお題選択が可能になります"}
            </Text>
          </>
        )}
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
