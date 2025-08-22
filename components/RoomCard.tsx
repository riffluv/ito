"use client";
import { AppCard } from "@/components/ui/AppCard";
import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";

export function RoomCard({
  name,
  status,
  count,
  onJoin,
}: {
  name: string;
  status: string;
  count: number;
  onJoin: () => void;
}) {
  const statusLabel = status === "waiting" ? "待機中" : "ゲーム中";
  return (
    <AppCard role="group" interactive className="animate-fadeInUp" minH={{ base: 32, md: 36 }}>
      <Stack gap={3}>
        <Text
          fontWeight="bold"
          fontSize="lg"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
        >
          {name}
        </Text>
        <HStack justify="space-between">
          <Text
            fontSize="sm"
            color="fgMuted"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            状態: {statusLabel}
          </Text>
          <Text
            fontSize="sm"
            color="fgMuted"
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            人数: {count}人
          </Text>
        </HStack>
        <AppButton
          colorPalette="brand"
          visual="soft"
          minW="8rem"
          whiteSpace="nowrap"
          onClick={onJoin}
          aria-label={`${name}に参加`}
        >
          参加
        </AppButton>
      </Stack>
    </AppCard>
  );
}
