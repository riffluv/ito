"use client";
import {
  Box,
  Container,
  Heading,
  HStack,
  Button,
  Text,
  useColorModeValue,
} from "@chakra-ui/react";

export default function Hero() {
  return (
    <Box
      pt={{ base: 12, md: 20 }}
      pb={{ base: 12, md: 16 }}
      bgGradient={useColorModeValue(
        "linear(to-b, white, gray.50)",
        "linear(to-b, gray.900, gray.800)"
      )}
      borderBottomWidth="1px"
      borderColor={useColorModeValue("gray.200", "whiteAlpha.200")}
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
        <Text mt="4" fontSize={{ base: "md", md: "lg" }} color={useColorModeValue("gray.600", "gray.300")}>
          シンプルで直感的、アクセシブル。Chakra UIベースの軽快なUIでプレイ。
        </Text>
        <HStack mt="8" spacing="4">
          <Button variant="brand" size="lg">今すぐプレイ</Button>
          <Button size="lg">ルールを見る</Button>
        </HStack>
      </Container>
    </Box>
  );
}

