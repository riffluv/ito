"use client";
import type { PlayerDoc } from "@/lib/types";
import { Box, Text } from "@chakra-ui/react";
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
    <Box padding={{ base: 3, md: 4 }}>
      {players.map((p) => (
        <Box
          key={p.id}
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          paddingY={3}
          borderBottom="1px solid"
          borderColor="borderDefault"
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
              <Text fontWeight={600} color="fgDefault" fontSize="sm">
                {p.name}
              </Text>
              
              {/* Player Badge */}
              <Box bg="blue.100" color="blue.700" fontSize="xs" px={2} py={0.5} borderRadius="2px" fontWeight={500}>
                プレイヤー
              </Box>
            </Box>
            
            {/* Player Clue: レイアウトの高さを常に確保してCLSを防止 */}
            <Box fontSize="0.875rem" minH="1.25rem">
              {p.clue1 ? (
                <Box color="fgMuted">{p.clue1}</Box>
              ) : (
                // スクリーンリーダーには読み上げさせない透明プレースホルダー
                <Box aria-hidden="true" visibility="hidden">placeholder</Box>
              )}
            </Box>
          </Box>
          
          {/* Player Status */}
          <Box w="8px" h="8px" borderRadius="50%" bg={p.ready ? "purple.500" : "purple.400"} mt={1} />
        </Box>
      ))}
    </Box>
  );
});
