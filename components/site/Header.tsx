"use client";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Container, Flex, HStack, Heading, Image } from "@chakra-ui/react";
import { usePathname, useRouter } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const isHome = pathname === "/";
  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex="overlay"
      borderBottomWidth="1px"
      borderColor="rgba(255,255,255,0.3)" // Hudと同じボーダー強度で統一
      bg="rgba(10,11,20,0.95)" // Hudと同じダークベースで統一
      backdropFilter="blur(8px)" // Hudと同じブラーレベル
      h="64px"
      display="flex"
      alignItems="center"
      css={{
        "--unified-header-height": UNIFIED_LAYOUT.HEADER_HEIGHT,
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
          "--unified-header-height": UNIFIED_LAYOUT.DPI_125.HEADER_HEIGHT,
          height: UNIFIED_LAYOUT.DPI_125.HEADER_HEIGHT,
        },
      }}
    >
      <Container maxW="5xl" px={6}>
        <Flex align="center" justify="space-between" h="100%">
          <HStack gap="3">
            <Image
              src="/images/knight1.png"
              alt="ITO Knight"
              boxSize="8"
              objectFit="contain"
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
            />
            <Heading
              fontSize="xl"
              fontWeight={700}
              lineHeight={1}
              letterSpacing="-0.02em"
              color="rgba(255,255,255,0.95)" // Hudと同じシンプルな白色
              textShadow="0 2px 4px rgba(0,0,0,0.7)" // Hudと同じテキストシャドウ
            >
              Online ITO
            </Heading>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}
