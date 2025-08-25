"use client";
import type { PlayerDoc } from "@/lib/types";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Avatar, Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";
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
    <Stack as="ul" role="list" gap="2" pl={0} m={0} listStyleType="none">
      {players.map((p) => (
        <Box as="li" key={p.id}>
          <HStack
            gap={3}
            p={2}
            borderWidth={UNIFIED_LAYOUT.BORDER_WIDTH}
            borderRadius="lg"
            h={{ base: 14, md: 14 }}
            align="center"
          >
            <Avatar.Root size="sm">
              <Avatar.Fallback name={p.name} />
            </Avatar.Root>
            <Stack gap={0.5} flex={1} minW={0}>
              <Text
                fontWeight="semibold"
                title={p.name}
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
              >
                {p.name}
              </Text>
              <Text
                fontSize="xs"
                color="fgMuted"
                overflow="hidden"
                textOverflow="ellipsis"
                whiteSpace="nowrap"
                title={p.clue1 || undefined}
              >
                {p.clue1 ? `連想: ${p.clue1}` : "\u00A0"}
              </Text>
            </Stack>
            <Badge colorPalette="green" flexShrink={0} display="inline-flex" alignItems="center" gap={1}>
              <CheckCircle2 size={14} /> 在室
            </Badge>
          </HStack>
        </Box>
      ))}
    </Stack>
  );
}
