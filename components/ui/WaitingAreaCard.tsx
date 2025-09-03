"use client";
import type { PlayerDoc } from "@/lib/types";
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
      width="120px"
      height="150px"
      borderRadius="xl"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="space-between"
      p={4}
      bg={ready ? "surfaceRaised" : "surfaceSubtle"}
      borderWidth="1px"
      borderColor="borderDefault"
      shadow={ready ? "cardRaised" : "panelSubtle"}
      transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
      _groupHover={{}}
      _hover={{ 
        transform: "translateY(-4px) scale(1.02)", 
        shadow: ready ? "cardElevated" : "cardRaised",
        bg: ready ? "surfaceRaised" : "surfaceRaised"
      }}
    >
      <Box
        fontSize="xs"
        fontWeight={600}
        letterSpacing="wide"
        color={ready ? "accent" : "fgMuted"}
        textTransform="uppercase"
        px={2}
        py={1}
        borderRadius="md"
        bg={ready ? "accentSubtle" : "transparent"}
      >
        {ready ? "Ready" : "Waiting"}
      </Box>
      <Box
        fontSize="md"
        fontWeight={500}
        color={ready ? "fgDefault" : "fgMuted"}
        textAlign="center"
        px={2}
        py={1}
        flex={1}
        display="flex"
        alignItems="center"
        justifyContent="center"
        lineHeight={1.3}
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
        color="fgDefault"
        fontWeight={600}
        maxW="100%"
        whiteSpace="nowrap"
        textOverflow="ellipsis"
        overflow="hidden"
        letterSpacing="tight"
      >
        {player.name}
      </Text>
    </Box>
  );
}
