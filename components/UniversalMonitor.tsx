"use client";
import { TopicDisplay } from "@/components/TopicDisplay";
import { Panel } from "@/components/ui/Panel";
import type { PlayerDoc, RoomDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box } from "@chakra-ui/react";
import Centered from "@/components/ui/Centered";

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
      marginBottom={{ base: "0.5rem", md: "0.75rem" }}
      css={{ 
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: { 
          marginBottom: "0.25rem" 
        } 
      }}
    >
      {/* シンプル化されたお題表示 - カードエリア拡大のため最小化 */}
      <Box
        fontSize={{ base: "1.125rem", md: "1.25rem" }}
        fontWeight={600}
        color="gray.700"
        lineHeight={1.2}
        px={4}
        py={2}
        bg="gray.50"
        borderRadius="md"
        border="1px solid"
        borderColor="gray.200"
        css={{ 
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: { 
            fontSize: "1rem",
            padding: "0.375rem 1rem"
          },
          [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_150}`]: { 
            fontSize: "0.875rem",
            padding: "0.25rem 0.75rem"
          }
        }}
      >
        <TopicDisplay room={room} inline />
      </Box>
    </Box>
  );
}
