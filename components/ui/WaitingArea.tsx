"use client";
import React from "react";
import { Box, Text } from "@chakra-ui/react";
import type { PlayerDoc } from "@/lib/types";

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
      bottom={{ base: "120px", md: "144px" }}
      zIndex={15}
      borderRadius="20px"
      p={{ base: 3, md: 4 }}
      css={{
        background:
          "linear-gradient(180deg, rgba(101,67,33,0.8) 0%, rgba(80,53,26,0.9) 100%)",
        border: "2px solid rgba(160,133,91,0.6)",
        backdropFilter: "blur(15px)",
        boxShadow: "0 8px 25px rgba(0,0,0,0.7), inset 0 2px 0 rgba(160,133,91,0.3)",
      }}
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
          <Box
            key={p.id}
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
              animation: "pulseW 2s ease-in-out infinite alternate",
            }}
          >
            <Text fontSize="10px" color="rgba(147,112,219,0.8)" letterSpacing="1px">
              {p.clue1 && p.clue1.trim() !== "" ? "READY" : "WAITING"}
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
              {p.clue1 && p.clue1.trim() !== "" ? p.clue1 : <span aria-hidden>💭</span>}
            </Box>
            <Text
              title={p.name}
              fontSize="11px"
              color="rgba(255,255,255,0.95)"
              fontWeight={600}
              maxW="100%"
              whiteSpace="nowrap"
              textOverflow="ellipsis"
              overflow="hidden"
            >
              {p.name}
            </Text>
          </Box>
        ))}
      </Box>

      <Box as="style">{`@keyframes pulseW{0%{opacity:.85}100%{opacity:1}}`}</Box>
    </Box>
  );
}
