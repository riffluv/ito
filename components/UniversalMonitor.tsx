"use client";
import { TopicDisplay } from "@/components/TopicDisplay";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Text } from "@chakra-ui/react";

// ドラクエ風フェーズアナウンス
const getPhaseAnnouncement = (status: string) => {
  switch (status) {
    case "waiting":
      return "▼ ゲーム準備中 ▼";
    case "clue": 
      return "▼ 連想ワードを考えよう ▼";
    case "playing":
      return "▼ 順番に並べよう ▼";
    case "finished":
      return "▼ 結果発表！ ▼";
    default:
      return "▼ ゲーム進行中 ▼";
  }
};

export default function UniversalMonitor({
  room,
  players,
}: {
  room: RoomDoc | null;
  players: (PlayerDoc & { id: string })[];
}) {
  if (!room) return null;

  return (
    <Box
      textAlign="center"
      marginBottom={{ base: "0.75rem", md: "1rem" }} // DPI100%基準で縮小
      css={{
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
          marginBottom: "0.5rem", // DPI125%はさらに縮小
        },
      }}
    >
      {/* ドラクエ風：深い背景＋白フチの情報窓 */}
      <Box
        display="inline-block"
        px={6}
        py={4}
        bg="rgba(15,15,35,0.95)"
        border="2px solid rgba(255,255,255,0.8)"
        borderRadius="8px"
        boxShadow="inset 0 1px 2px rgba(255,255,255,0.1), 0 4px 8px rgba(0,0,0,0.3)"
        backdropFilter="blur(8px)"
      >
        <Box
          as="div"
          fontSize="sm"
          fontWeight={700}
          lineHeight={1}
          color="rgba(255,255,255,0.95)"
          textShadow="0 1px 2px rgba(0,0,0,0.5)"
        >
          <TopicDisplay room={room} inline />
          
          {/* ドラクエ風フェーズアナウンス */}
          <Text
            fontSize="xs"
            fontWeight={500}
            color="rgba(255,255,255,0.8)"
            textShadow="0 1px 2px rgba(0,0,0,0.5)"
            letterSpacing="0.5px"
            mt={2}
            fontFamily="mono"
          >
            {getPhaseAnnouncement(room.status)}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
