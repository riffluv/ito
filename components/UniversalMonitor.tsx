"use client";
import { TopicDisplay } from "@/components/TopicDisplay";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
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
        bg={UI_TOKENS.COLORS.panelBg}
        border={`2px solid ${UI_TOKENS.COLORS.whiteAlpha80}`}
        borderRadius="8px"
        boxShadow={UI_TOKENS.SHADOWS.panelSubtle}
        backdropFilter="blur(8px)"
      >
        <Box
          as="div"
          fontSize="sm"
          fontWeight={700}
          lineHeight={1}
          color={UI_TOKENS.COLORS.whiteAlpha95}
          textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
        >
          <TopicDisplay room={room} inline />
          {/* フェーズアナウンスは別コンポーネント（GSAPアニメーション版）に移行 */}
        </Box>
      </Box>
    </Box>
  );
}
