"use client";

import { Box, Text } from "@chakra-ui/react";

type SafeUpdateBannerProps = {
  offsetTop?: number;
};

export default function SafeUpdateBanner({ offsetTop = 12 }: SafeUpdateBannerProps) {
  return (
    <Box
      position="fixed"
      top={`${offsetTop}px`}
      right="16px"
      zIndex={1300}
      background="rgba(12, 16, 24, 0.88)"
      border="1px solid rgba(255, 255, 255, 0.25)"
      borderRadius="6px"
      padding="12px 16px"
      color="rgba(255,255,255,0.92)"
      fontFamily="'Courier New', monospace"
      pointerEvents="none"
      boxShadow="0 8px 18px rgba(0,0,0,0.35)"
      maxW="240px"
    >
      <Text fontSize="13px" letterSpacing="0.14em" textTransform="uppercase">
        新バージョン待機中
      </Text>
      <Text fontSize="12px" mt="6px" lineHeight="1.6">
        安全ポイントで自動更新
      </Text>
    </Box>
  );
}
