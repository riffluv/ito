"use client";
import { TopicDisplay } from "@/components/TopicDisplay";
import { Panel } from "@/components/ui/Panel";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
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
      style={{
        minHeight: 300,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* top banner */}
      <Box
        style={{
          background: "linear-gradient(90deg,#ff9a58,#ffcf67)",
          padding: "8px 16px",
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          color: "#0f1724",
          fontWeight: 700,
          fontSize: 14,
        }}
      >
        ラウンド {room?.round ?? 1} | カテゴリ:{" "}
        {(room as any)?.topicBox ?? "未選択"}
      </Box>

      <Box style={{ padding: "28px 20px", textAlign: "center" }}>
        {/* Topic selection is allowed only after game start (clue phase) */}
        {room.status === "clue" && (
          <Box mb={4}>
            <TopicDisplay roomId={roomId} room={room} isHost={isHost} />
          </Box>
        )}

        <Text
          fontSize={{ base: "lg", md: "2.25rem" }}
          fontWeight="800"
          style={{ color: "#7bd3b6" }}
        >
          {room.topic
            ? `お題：${room.topic}`
            : room.status === "waiting"
            ? "ゲーム開始後にお題を選択できます"
            : "お題が未設定です"}
        </Text>
        <Text fontSize="sm" color="fgMuted" mt={2}>
          {room.status === "clue" && "カードを並べてください（ミスすると失敗）"}
          {room.status === "waiting" &&
            "ホストがゲームを開始するとお題選択が可能になります"}
        </Text>
      </Box>

      {room.status === "finished" && (
        <Box mt={4}>
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
