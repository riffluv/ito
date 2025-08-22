"use client";
import { Box, Container, Heading, HStack, Text } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";

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
      borderBottomWidth="1px"
      borderColor="borderDefault"
    >
      <Container maxW="6xl" position="relative">
        <Heading
          size={{ base: "2xl", md: "3xl" }}
          lineHeight="1.1"
          bgGradient="linear(to-r, brand.400, orange.400)"
          bgClip="text"
          letterSpacing="tight"
        >
          みんなで“数の感覚”を合わせるオンラインITO
        </Heading>
        <Text mt="4" fontSize={{ base: "md", md: "lg" }} color="fgMuted">
          シンプルで直感的、アクセシブル。Chakra UIベースの軽快なUIでプレイ。
        </Text>
        <HStack mt="8" gap="4">
          <AppButton visual="soft" palette="orange" size="lg" onClick={onPlay} minW="10.5rem">
            今すぐプレイ
          </AppButton>
          <AppButton size="lg" variant="subtle" onClick={onRules} minW="10.5rem">
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
