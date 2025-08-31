"use client";
import React from "react";
import { Box, Text } from "@chakra-ui/react";
import type { PlayerDoc } from "@/lib/types";
import WaitingAreaCard from "@/components/ui/WaitingAreaCard";
import { DOCK_BOTTOM_MOBILE, DOCK_BOTTOM_DESKTOP } from "@/lib/ui/layout";

export interface WaitingAreaProps {
  players: (PlayerDoc & { id: string })[];
  title?: string;
}

export default function WaitingArea({ players, title = "未提出の参加者" }: WaitingAreaProps) {
  return (
    <Box
      position="fixed"
      left={{ base: 3, md: 6 }}
      right={{ base: 3, md: 6 }}
      bottom={{ base: DOCK_BOTTOM_MOBILE, md: DOCK_BOTTOM_DESKTOP }}
      zIndex={15}
      borderRadius="20px"
      p={{ base: 3, md: 4 }}
      bgGradient="panelWood"
      borderWidth="2px"
      borderColor="woodBorder"
      css={{ backdropFilter: "blur(15px)", boxShadow: "var(--shadows-panelWood)" }}
    >
      <Text
        textAlign="center"
        fontWeight={600}
        fontSize="14px"
        letterSpacing="1px"
        color="rgba(160,133,91,1)"
        mb={3}
      >
        {title}
      </Text>

      <Box display="flex" gap={3} flexWrap="wrap" justifyContent="center">
        {players.map((p) => (
          <WaitingAreaCard key={p.id} player={p} />
        ))}
      </Box>

      <Box as="style">{`@keyframes pulseW{0%{opacity:.85}100%{opacity:1}}`}</Box>
    </Box>
  );
}
