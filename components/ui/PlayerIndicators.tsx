"use client";
import React from "react";
import { Box, Text } from "@chakra-ui/react";
import type { PlayerDoc } from "@/lib/types";

export default function PlayerIndicators({
  players,
  onlineCount,
}: {
  players: (PlayerDoc & { id: string })[];
  onlineCount: number;
}) {
  const total = players.length;
  const submitted = players.filter((p) => !!p?.clue1 && String(p.clue1).trim() !== "").length;

  const Card = ({ pos }: { pos: "left" | "right" }) => (
    <Box
      className={`player-indicator ${pos === "left" ? "top-left" : "top-right"}`}
      position="fixed"
      top={{ base: "84px", md: "100px" }}
      left={pos === "left" ? { base: 3, md: 6 } : undefined}
      right={pos === "right" ? { base: 3, md: 6 } : undefined}
      zIndex={15}
      borderRadius="15px"
      p={3}
      minW={{ base: "180px", md: "220px" }}
      css={{
        background:
          "linear-gradient(135deg, rgba(101,67,33,0.9), rgba(139,115,85,0.9))",
        border: "2px solid rgba(160,133,91,0.7)",
        backdropFilter: "blur(15px)",
        boxShadow:
          "0 8px 25px rgba(0,0,0,0.6), 0 0 15px rgba(160,133,91,0.3), inset 0 2px 0 rgba(160,133,91,0.4)",
      }}
    >
      {pos === "left" ? (
        <>
          <Text fontSize="12px" color="rgba(255,255,255,0.9)" fontWeight={600} mb={1}>
            提出状況
          </Text>
          <Text color="rgba(160,133,91,1)" fontWeight={700}>
            {submitted}/{total} 提出
          </Text>
        </>
      ) : (
        <>
          <Text fontSize="12px" color="rgba(255,255,255,0.9)" fontWeight={600} mb={1}>
            プレイヤー
          </Text>
          <Text color="rgba(160,133,91,1)" fontWeight={700}>
            {onlineCount}/{total} 接続中
          </Text>
        </>
      )}
    </Box>
  );

  return (
    <>
      <Card pos="left" />
      <Card pos="right" />
    </>
  );
}

