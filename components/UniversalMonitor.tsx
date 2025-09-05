"use client";
import { TopicDisplay } from "@/components/TopicDisplay";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import DQWindow from "@/components/ui/DQWindow";

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
      marginBottom={{ base: "1rem", md: "1.25rem" }}
      css={{ [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: { marginBottom: "0.75rem" } }}
    >
      {/* DQ風：黒地＋白フチの情報窓（角丸・ぼかし無し） */}
      <DQWindow as="div" frame="thin" display="inline-block" px={4} py={3}>
        <Box as="div" fontSize="sm" fontWeight={700} lineHeight={1}>
          <TopicDisplay room={room} inline />
        </Box>
      </DQWindow>
    </Box>
  );
}

