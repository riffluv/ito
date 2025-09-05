"use client";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Text } from "@chakra-ui/react";

export default function WaitingAreaCard({
  player,
}: {
  player: PlayerDoc & { id: string };
}) {
  const ready = !!(player?.clue1 && player.clue1.trim() !== "");
  return (
    <Box
      role="group"
      width={UNIFIED_LAYOUT.CARD.WIDTH}
      height="150px"
      borderRadius="8px"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="space-between"
      p={4}
      bg={ready ? "rgba(74,158,255,0.15)" : "rgba(0,0,0,0.6)"} // ドラクエ風の背景
      border="1px solid"
      borderColor={ready ? "rgba(74,158,255,0.6)" : "rgba(255,255,255,0.3)"}
      boxShadow={
        ready
          ? "inset 0 1px 2px rgba(74,158,255,0.1), 0 4px 8px rgba(0,0,0,0.2)"
          : "inset 0 1px 2px rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.2)"
      }
      transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
      _groupHover={{}}
      _hover={{
        transform: "translateY(-2px) scale(1.02)",
        boxShadow: ready
          ? "inset 0 1px 2px rgba(74,158,255,0.2), 0 6px 12px rgba(0,0,0,0.3)"
          : "inset 0 1px 2px rgba(255,255,255,0.1), 0 4px 8px rgba(0,0,0,0.3)",
        borderColor: ready ? "rgba(74,158,255,0.8)" : "rgba(255,255,255,0.5)",
      }}
    >
      <Box
        fontSize="xs"
        fontWeight={600}
        letterSpacing="wide"
        color={ready ? "#4a9eff" : "rgba(255,255,255,0.7)"}
        textTransform="uppercase"
        px={2}
        py={1}
        borderRadius="4px"
        bg={ready ? "rgba(74,158,255,0.2)" : "transparent"}
        border={
          ready ? "1px solid rgba(74,158,255,0.3)" : "1px solid transparent"
        }
      >
        {ready ? "Ready" : "Waiting"}
      </Box>
      <Box
        fontSize="md"
        fontWeight={500}
        color={ready ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.7)"}
        textAlign="center"
        px={2}
        py={1}
        flex={1}
        display="flex"
        alignItems="center"
        justifyContent="center"
        lineHeight={1.3}
        textShadow="0 1px 2px rgba(0,0,0,0.5)"
        css={{
          display: "-webkit-box",
          WebkitLineClamp: 4,
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
        fontSize="sm"
        color="rgba(255,255,255,0.95)"
        fontWeight={600}
        maxW="100%"
        whiteSpace="nowrap"
        textOverflow="ellipsis"
        overflow="hidden"
        letterSpacing="tight"
        textShadow="0 1px 2px rgba(0,0,0,0.5)"
        px={2}
        py={1}
        borderRadius="4px"
        bg="rgba(0,0,0,0.2)"
        border="1px solid rgba(255,255,255,0.2)"
      >
        {player.name}
      </Text>
    </Box>
  );
}
