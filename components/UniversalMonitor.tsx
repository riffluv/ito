"use client";
import { TopicDisplay } from "@/components/TopicDisplay";
import { AppButton } from "@/components/ui/AppButton";
import { notify } from "@/components/ui/notify";
import { Panel } from "@/components/ui/Panel";
import { submitSortedOrder } from "@/lib/game/room";
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
              style={{ color: "#7bd3b6" }}
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
        {/* If host, expose primary actions (start/next) in the monitor for easier access */}
        {isHost &&
          room.status === "clue" &&
          room.options?.resolveMode === "sort-submit" && (
            <Box style={{ textAlign: "center", padding: "12px 0" }}>
              <AppButton
                colorPalette="teal"
                size="sm"
                onClick={async () => {
                  const proposal: string[] =
                    (room as any)?.order?.proposal || [];
                  const playerIds = players.map((p) => p.id);
                  if (proposal.length === 0) {
                    notify({
                      title: "まだカードが場にありません",
                      type: "info",
                    });
                    return;
                  }
                  // 全員のカードが含まれているか（オンラインでない人を含む? 今は数字配布された全員=proposal長とplayerIdsの割当済み人数を比較）
                  const assigned = players
                    .filter((p) => typeof (p as any).number === "number")
                    .map((p) => p.id);
                  if (assigned.length !== proposal.length) {
                    notify({
                      title: "まだ全員のカードが場に出ていません",
                      type: "warning",
                    });
                    return;
                  }
                  try {
                    await submitSortedOrder(roomId, proposal);
                    notify({ title: "一括判定を実行", type: "success" });
                  } catch (err: any) {
                    notify({
                      title: "一括判定失敗",
                      description: err?.message,
                      type: "error",
                    });
                  }
                }}
              >
                せーので判定！
              </AppButton>
            </Box>
          )}
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
