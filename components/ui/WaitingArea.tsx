"use client";
import WaitingAreaCard from "@/components/ui/WaitingAreaCard";
import type { PlayerDoc } from "@/lib/types";
import { DOCK_BOTTOM_DESKTOP, DOCK_BOTTOM_MOBILE } from "@/lib/ui/layout";
import { Box, Text } from "@chakra-ui/react";

export interface WaitingAreaProps {
  players: (PlayerDoc & { id: string })[];
  title?: string;
}

export default function WaitingArea({ players, title = "" }: WaitingAreaProps) {
  return (
    <Box
      position="fixed"
      left={{ base: 3, md: 6 }}
      right={{ base: 3, md: 6 }}
      bottom={{ base: DOCK_BOTTOM_MOBILE, md: DOCK_BOTTOM_DESKTOP }}
      zIndex={15}
      p={{ base: 3, md: 4 }}
    >
      {title && (
        <Text
          textAlign="center"
          fontWeight={600}
          fontSize="14px"
          letterSpacing="1px"
          color="rgba(255,255,255,0.9)" // ドラクエ風の白文字
          mb={3}
          textShadow="0 1px 2px rgba(0,0,0,0.5)" // ドラクエ風のテキストシャドウ
        >
          {title}
        </Text>
      )}

      <Box display="flex" gap={3} flexWrap="wrap" justifyContent="center">
        {players.map((p) => (
          <WaitingAreaCard key={p.id} player={p} />
        ))}
      </Box>

      <Box as="style">{`@keyframes pulseW{0%{opacity:.85}100%{opacity:1}}`}</Box>
    </Box>
  );
}
