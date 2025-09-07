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
              alt="序の紋章III Knight"
              boxSize="8"
              objectFit="contain"
              filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"
            />
            <Heading
              fontSize="xl"
              fontWeight={800}
              lineHeight={1}
              letterSpacing="0.02em"
              color="rgba(255,255,255,0.95)"
              textShadow="1px 1px 0 rgba(0,0,0,0.9), 
                         2px 2px 4px rgba(0,0,0,0.7),
                         0 0 8px rgba(255,215,0,0.2)"
              fontFamily="'Hiragino Kaku Gothic ProN', 'Noto Sans CJK JP', 'Yu Gothic', YuGothic, 'Meiryo UI', Meiryo, 'MS PGothic', sans-serif"
              css={{
                WebkitTextStroke: "0.5px rgba(255,255,255,0.1)",
                filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))"
              }}
            >
              序の紋章III
            </Heading>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}
