"use client";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Text } from "@chakra-ui/react";

export default function PlayerIndicators({
  players,
  onlineCount,
}: {
  players: (PlayerDoc & { id: string })[];
  onlineCount: number;
}) {
  const total = players.length;
  const submitted = players.filter(
    (p) => !!p?.clue1 && String(p.clue1).trim() !== ""
  ).length;

  return (
    <Box
      className="player-indicator top-left"
      position="fixed"
      top={{ base: "140px", md: "160px" }}
      left={{ base: 3, md: 6 }}
      zIndex={UNIFIED_LAYOUT.Z_INDEX.PANEL}
      borderRadius={0}
      px={4}
      py={3}
      minW={{ base: "170px", md: "200px" }}
      bg="surfaceOverlay"
      borderWidth="1px"
      borderColor="borderDefault"
      boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
      display="flex"
      flexDirection="column"
      gap={1}
      transition="background-color .25s, border-color .25s, box-shadow .25s, transform .25s"
      _hover={{ transform: "translateY(-2px)", boxShadow: "3px 3px 0 rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.6)" }}
    >
      <Text
        fontSize="11px"
        color="fgMuted"
        fontWeight={600}
        letterSpacing="0.5px"
        textTransform="uppercase"
      >
        プレイヤー
      </Text>
      <Text color="accent" fontWeight={700} fontSize="14px">
        {onlineCount}/{total} 接続中
      </Text>
    </Box>
  );
}
