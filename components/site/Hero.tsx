"use client";
import { Box, Container, Heading, HStack, Text } from "@chakra-ui/react";
import { AppButton } from "@/components/ui/AppButton";

export default function Hero() {
  return (
    <Box
      position="relative"
      overflow="hidden"
      pt={{ base: 14, md: 24 }}
      pb={{ base: 12, md: 18 }}
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
          bgGradient="linear(to-r, brand.400, cyan.400)"
          bgClip="text"
          letterSpacing="tight"
        >
          みんなで“数の感覚”を合わせるオンラインITO
        </Heading>
        <Text mt="4" fontSize={{ base: "md", md: "lg" }} color="fgMuted">
          シンプルで直感的、アクセシブル。Chakra UIベースの軽快なUIでプレイ。
        </Text>
        <HStack mt="8" gap="4">
          <AppButton colorPalette="orange" size="lg">
            今すぐプレイ
          </AppButton>
          <AppButton size="lg" variant="outline">
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
        bgGradient="radial(brand.400 10%, transparent 60%)"
        opacity={0.25}
        filter="blur(40px)"
      />
      <Box
        aria-hidden
        position="absolute"
        bottom={{ base: "-12%", md: "-20%" }}
        left={{ base: "-10%", md: "-10%" }}
        w={{ base: "50%", md: "40%" }}
        h={{ base: "50%", md: "40%" }}
        bgGradient="radial(cyan.400 10%, transparent 60%)"
        opacity={0.18}
        filter="blur(40px)"
      />
    </Box>
  );
}
