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
      marginBottom={{ base: "1rem", md: "2rem" }}
    >
      {/* Professional Theme Card - モックデザイン準拠 */}
      <Box
        bg="#0f172a" // --slate-900
        color="white"
        padding={{ base: "1.5rem", md: "2rem" }}
        borderRadius="1.5rem" // --radius-2xl
        boxShadow="0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)" // --shadow-lg
        marginBottom={{ base: "0.75rem", md: "1rem" }}
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
      <Box
        color="#64748b" // --slate-500
        maxWidth="480px"
        margin="0 auto"
        fontSize={{ base: "0.875rem", md: "1rem" }}
        padding={{ base: "0 1rem", md: "0" }}
      >
        あなたの数字を「{(room as any)?.topic || "お題"}」で表現してください。<br />
        <Box as="strong">数字そのものは絶対に言わないように！</Box>
      </Box>
    </Box>
  );
}
