"use client";
import { AppButton } from "@/components/ui/AppButton";
import { Box, Container, HStack, Text } from "@chakra-ui/react";

type Props = {
  onPlay?: () => void;
  onRules?: () => void;
};

export default function Hero({ onPlay, onRules }: Props) {
  return (
    <Box
      position="relative"
      overflow="hidden"
      pt={{ base: 16, md: 24 }}
      pb={{ base: 14, md: 20 }}
      bgGradient={{
        base: "linear(to-b, canvasBg, panelSubBg)",
        _dark: "linear(to-b, canvasBg, panelSubBg)",
      }}
      boxShadow="0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px 0 rgba(0,0,0,0.06)"
    >
      <Container maxW="6xl" position="relative">
        {/* hero heading removed per request to avoid transparent selectable text */}
        <Text mt="4" fontSize={{ base: "md", md: "lg" }} color="fgMuted">
          シンプルで直感的、アクセシブル。Chakra UIベースの軽快なUIでプレイ。
        </Text>
        <HStack mt="8" gap="4">
          <AppButton
            visual="soft"
            palette="orange"
            size="lg"
            onClick={onPlay}
            minW="10.5rem"
          >
            今すぐプレイ
          </AppButton>
          <AppButton
            size="lg"
            variant="subtle"
            onClick={onRules}
            minW="10.5rem"
          >
            ルールを見る
          </AppButton>
        </HStack>
      </Container>

      {/* subtle gradient orbs */}
      <Box
        aria-hidden
        position="absolute"
        top={{ base: "-10%", md: "-20%" }}
        right={{ base: "-20%", md: "-10%" }}
        w={{ base: "60%", md: "40%" }}
        h={{ base: "60%", md: "40%" }}
        bgGradient="radial(orange.400 10%, transparent 60%)"
        opacity={0.3}
        filter="blur(40px)"
      />
      <Box
        aria-hidden
        position="absolute"
        bottom={{ base: "-12%", md: "-20%" }}
        left={{ base: "-10%", md: "-10%" }}
        w={{ base: "50%", md: "40%" }}
        h={{ base: "50%", md: "40%" }}
        bgGradient="radial(brand.400 10%, transparent 60%)"
        opacity={0.22}
        filter="blur(40px)"
      />
    </Box>
  );
}
