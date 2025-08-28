"use client";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Avatar, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { CheckCircle2 } from "lucide-react";
import { memo } from "react";

export const Participants = memo(function Participants({
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
            
            {/* Player Clue: レイアウトの高さを常に確保してCLSを防止 */}
            <Box fontSize="0.875rem" minH="1.25rem">
              {p.clue1 ? (
                <Box color="#64748b">{p.clue1}</Box>
              ) : (
                // スクリーンリーダーには読み上げさせない透明プレースホルダー
                <Box aria-hidden="true" visibility="hidden">placeholder</Box>
              )}
            </Box>
          </Box>
          
          {/* Player Status */}
          <Box
            width="8px"
            height="8px"
            borderRadius="50%"
            bg={p.ready ? "#22c55e" : "#10b981"} // --green-500 : --emerald-500 (オンライン感のある緑)
            marginTop={1}
          />
        </Box>
      ))}
    </Box>
  );
});
