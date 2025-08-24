"use client";
import { Badge, Box, HStack, Progress, Spacer } from "@chakra-ui/react";

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

export function Hud({
  roomName,
  phase,
  activeCount = 0,
  totalCount = 0,
  remainMs,
  totalMs,
  hostPrimary,
}: HudProps) {
  const pct =
    totalMs && remainMs != null && totalMs > 0
      ? Math.max(0, Math.min(100, (remainMs / totalMs) * 100))
      : undefined;
  const phaseLabel = {
    waiting: "待機",
    clue: "入力",
    playing: "並べ替え",
    reveal: "公開",
    finished: "結果",
  }[phase];

  return (
    <Box
      layerStyle="hud"
      position="sticky"
      top={0}
      zIndex={10}
      px={3}
      py={2}
      aria-label="現在のゲームフェーズと進行状況"
      role="region"
    >
      <HStack>
        <HStack minW={0} gap={3}>
          <Badge variant="subtle" colorPalette="gray" borderRadius="md" px={2}>
            {phaseLabel}
          </Badge>
        </HStack>
        <Spacer />
        <Box flex={1} maxW={480}>
          {typeof pct === "number" && (
            <Progress.Root
              value={pct}
              size="xs"
              colorPalette="orange"
              rounded="full"
            >
              <Progress.Track bg="panelSubBg">
                <Progress.Range />
              </Progress.Track>
            </Progress.Root>
          )}
        </Box>
        <Spacer />
        {/* hostPrimary controls intentionally removed to simplify header UI */}
      </HStack>
    </Box>
  );
}
