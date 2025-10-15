"use client";

import { stripeUiEnabled } from "@/lib/stripe/status";
import { Box, Text, VStack } from "@chakra-ui/react";

/**
 * Stripe UI を露出する際のプレースホルダー。
 * 現状は Stripe フラグが有効化されるまで非表示。
 */
export function SupporterCTA() {
  if (!stripeUiEnabled) {
    return null;
  }

  return (
    <Box
      mt={6}
      border="1px solid rgba(255,255,255,0.2)"
      bg="rgba(12,14,20,0.72)"
      px={6}
      py={5}
      borderRadius="lg"
      boxShadow="0 12px 30px rgba(0,0,0,0.45)"
    >
      <VStack align="flex-start" gap={3}>
        <Text
          fontSize={{ base: "lg", md: "xl" }}
          fontWeight={700}
          letterSpacing="0.04em"
          color="rgba(255,255,255,0.92)"
        >
          冒険を支援する
        </Text>
        <Text fontSize="sm" color="rgba(255,255,255,0.72)">
          コミュニティ拡大に合わせて、ここから支援プランを選択できるようにします。
        </Text>
      </VStack>
    </Box>
  );
}
