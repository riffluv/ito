"use client";
import React from "react";
import { Box, Text } from "@chakra-ui/react";
import type { PlayerDoc } from "@/lib/types";

export default function WaitingAreaCard({ player }: { player: (PlayerDoc & { id: string }) }) {
  const ready = !!(player?.clue1 && player.clue1.trim() !== "");
  return (
    <Box
      width="100px"
      height="140px"
      borderRadius="15px"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="space-between"
      p={2}
      css={{
        background:
          "linear-gradient(135deg, rgba(60,30,90,0.85) 0%, rgba(80,40,120,0.85) 100%)",
        border: "2px solid rgba(147,112,219,0.6)",
        boxShadow: "0 6px 20px rgba(147,112,219,0.25)",
      }}
    >
      <Text fontSize="10px" color="rgba(147,112,219,0.8)" letterSpacing="1px">
        {ready ? "READY" : "WAITING"}
      </Text>
      <Box
        fontSize="12px"
        color="rgba(255,215,0,0.9)"
        textAlign="center"
        px={1}
        css={{
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textOverflow: "ellipsis",
          wordBreak: "break-word",
        }}
      >
        {ready ? player.clue1 : <span aria-hidden>💭</span>}
      </Box>
      <Text
        title={player.name}
        fontSize="11px"
        color="rgba(255,255,255,0.95)"
        fontWeight={600}
        maxW="100%"
        whiteSpace="nowrap"
        textOverflow="ellipsis"
        overflow="hidden"
      >
        {player.name}
      </Text>
    </Box>
  );
}

