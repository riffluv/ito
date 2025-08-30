"use client";
import { TopicDisplay } from "@/components/TopicDisplay";
import { Panel } from "@/components/ui/Panel";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";

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
      marginBottom={{ base: "0.75rem", md: "1.25rem" }}
      css={{
        // 125% DPI では上下余白をさらに微調整して中央のスクロール発生を抑止
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
          marginBottom: "0.5rem",
        },
      }}
    >
      {/* Professional Theme Card - モックデザイン準拠 */}
      <Box
        bg="#0f172a" // --slate-900
        color="white"
        padding={{ base: "1.25rem", md: "1.75rem" }}
        borderRadius="1.5rem" // --radius-2xl
        boxShadow="0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)" // --shadow-lg
        marginBottom={{ base: "0.5rem", md: "0.75rem" }}
        css={{
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
            padding: "1rem",
            marginBottom: "0.5rem",
          },
        }}
      >
        <Box
          fontSize="0.875rem"
          opacity={0.8}
          marginBottom="0.5rem"
          textTransform="uppercase"
          letterSpacing="0.05em"
        >
          今回のお題
        </Box>
        <Box
          fontSize={{ base: "1.875rem", md: "2.25rem" }} // responsive text size
          fontWeight={700}
          lineHeight={1.1}
        >
          <TopicDisplay room={room} inline />
        </Box>
      </Box>
      
      {/* Instruction Text - モックデザイン準拠 */}
    </Box>
  );
}
