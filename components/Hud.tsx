"use client";
import {
  Avatar,
  AvatarGroup,
  Badge,
  Box,
  Button,
  HStack,
  Progress,
  Spacer,
  Text,
} from "@chakra-ui/react";

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
    <Box layerStyle="hud" position="sticky" top={0} zIndex={10} px={3} py={2}>
      <HStack>
        <HStack minW={0} gap={3}>
          <Text fontWeight="bold" lineClamp={1}>
            {roomName}
          </Text>
          <Badge variant="subtle" colorPalette="gray" borderRadius="md" px={2}>
            {phaseLabel}
          </Badge>
        </HStack>
        <Spacer />
        <HStack gap={3} minW={{ base: 0, md: 300 }} flex={1} maxW={480}>
          <HStack gap={2}>
            <AvatarGroup size="xs">
              {/* 実アバターはサーバーデータ未連携のためダミー表示。将来、HUD props にアバター配列を追加して置換する */}
              <Avatar.Root size="xs">
                <Avatar.Fallback name="A" />
              </Avatar.Root>
              <Avatar.Root size="xs">
                <Avatar.Fallback name="B" />
              </Avatar.Root>
              <Avatar.Root size="xs">
                <Avatar.Fallback name="C" />
              </Avatar.Root>
            </AvatarGroup>
            <Badge borderRadius="full" px={2} colorPalette="gray">
              +{Math.max(0, (totalCount || 0) - 3)}
            </Badge>
          </HStack>
          <Text fontSize="sm" color="fgMuted" whiteSpace="nowrap">
            {activeCount}/{totalCount}
          </Text>
          <Box flex={1}>
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
        </HStack>
        <Spacer />
        {hostPrimary ? (
          <Button
            colorPalette="orange"
            onClick={hostPrimary.onClick}
            disabled={hostPrimary.disabled}
            title={hostPrimary.title}
          >
            {hostPrimary.label}
          </Button>
        ) : (
          <Button variant="outline" disabled opacity={0.6}>
            操作不可
          </Button>
        )}
      </HStack>
    </Box>
  );
}
