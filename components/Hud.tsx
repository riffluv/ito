"use client";
import { Box, HStack, Text, Badge, Progress, Button, Spacer } from "@chakra-ui/react";

export type HudProps = {
  roomName: string;
  phase: "waiting" | "clue" | "playing" | "reveal" | "finished";
  activeCount?: number;
  totalCount?: number;
  remainMs?: number | null;
  totalMs?: number | null;
  hostPrimary?: {
    label: string;
    onClick: () => void | Promise<void>;
    disabled?: boolean;
    title?: string;
  } | null;
};

export function Hud({ roomName, phase, activeCount = 0, totalCount = 0, remainMs, totalMs, hostPrimary }: HudProps) {
  const pct = totalMs && remainMs != null && totalMs > 0 ? Math.max(0, Math.min(100, (remainMs / totalMs) * 100)) : undefined;
  const phaseLabel = {
    waiting: "待機",
    clue: "入力",
    playing: "並べ替え",
    reveal: "公開",
    finished: "結果",
  }[phase];

  return (
    <Box layerStyle="hud" position="sticky" top={0} zIndex={10} px={3} py={2}>
      <HStack>
        <HStack minW={0} spacing={3}>
          <Text fontWeight="bold" noOfLines={1}>{roomName}</Text>
          <Badge variant="subtle" colorScheme="blue" borderRadius="md" px={2}>{phaseLabel}</Badge>
        </HStack>
        <Spacer />
        <HStack spacing={3} minW={{ base: 0, md: 300 }} flex={1} maxW={480}>
          <Text fontSize="sm" color="fgMuted" whiteSpace="nowrap">{activeCount}/{totalCount}</Text>
          <Box flex={1}>
            {typeof pct === "number" && (
              <Progress size="xs" value={pct} colorScheme="blue" borderRadius="full" bg="panelSubBg" />
            )}
          </Box>
        </HStack>
        <Spacer />
        {hostPrimary ? (
          <Button colorScheme="blue" onClick={hostPrimary.onClick} isDisabled={hostPrimary.disabled} title={hostPrimary.title}>
            {hostPrimary.label}
          </Button>
        ) : (
          <Button variant="outline" isDisabled opacity={0.6}>操作不可</Button>
        )}
      </HStack>
    </Box>
  );
}
