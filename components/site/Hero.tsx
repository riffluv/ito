"use client";
import {
  Box,
  Button,
  Container,
  Heading,
  HStack,
  Text,
} from "@chakra-ui/react";

export default function Hero() {
  return (
    <Box
      pt={{ base: 12, md: 20 }}
      pb={{ base: 12, md: 16 }}
      bgGradient={{
        base: "linear(to-b, white, gray.50)",
        _dark: "linear(to-b, gray.900, gray.800)",
      }}
      borderBottomWidth="1px"
      borderColor={{ base: "gray.200", _dark: "whiteAlpha.200" }}
    >
      <Container maxW="6xl">
        <Heading
          size={{ base: "xl", md: "2xl" }}
          lineHeight="1.1"
          bgGradient="linear(to-r, brand.400, cyan.400)"
          bgClip="text"
        >
          みんなで“数の感覚”を合わせるオンラインITO
        </Heading>
        <Text
          mt="4"
          fontSize={{ base: "md", md: "lg" }}
          color={{ base: "gray.600", _dark: "gray.300" }}
        >
          シンプルで直感的、アクセシブル。Chakra UIベースの軽快なUIでプレイ。
        </Text>
        <HStack mt="8" gap="4">
          <Button colorPalette="orange" size="lg">
            今すぐプレイ
          </Button>
          <Button size="lg">ルールを見る</Button>
        </HStack>
      </Container>
    </Box>
  );
}
