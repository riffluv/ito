"use client";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Avatar, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { CheckCircle2 } from "lucide-react";

export function Participants({
  players,
}: {
  players: (PlayerDoc & { id: string })[]; // derived participants only
}) {
  if (players.length === 0) {
    return (
      <Text fontSize="sm" color="fgMuted">
        誰もオンラインではありません
      </Text>
    );
  }
  return (
    <Box
      padding="1rem 1.5rem"
    >
      {players.map((p) => (
        <Box
          key={p.id}
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          padding="0.75rem 0"
          borderBottom="1px solid #f1f5f9" // --slate-100
          _last={{
            borderBottom: "none"
          }}
        >
          {/* Player Info */}
          <Box flex={1}>
            <Box
              display="flex"
              alignItems="center"
              gap={2}
              marginBottom={1}
            >
              <Text
                fontWeight={600}
                color="#0f172a" // --slate-900
                fontSize="sm"
              >
                {p.name}
              </Text>
              
              {/* Player Badge */}
              <Box
                bg="#dbeafe" // --blue-100
                color="#0369a1" // --blue-700
                fontSize="0.75rem"
                padding="0.125rem 0.5rem"
                borderRadius="0.125rem"
                fontWeight={500}
              >
                プレイヤー
              </Box>
            </Box>
            
            {/* Player Clue */}
            <Box
              fontSize="0.875rem"
              color={p.clue1 ? "#64748b" : "#94a3b8"} // --slate-500 : --slate-400
              fontStyle={p.clue1 ? "normal" : "italic"}
            >
              {p.clue1 ? `ヒント: ${p.clue1}` : "ヒント入力中..."}
            </Box>
          </Box>
          
          {/* Player Status */}
          <Box
            width="8px"
            height="8px"
            borderRadius="50%"
            bg={p.ready ? "#22c55e" : "#0ea5e9"} // --green-500 : --blue-500
            marginTop={1}
          />
        </Box>
      ))}
    </Box>
  );
}
