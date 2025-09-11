"use client";
import { UNIFIED_LAYOUT, UI_TOKENS } from "@/theme/layout";
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
      borderColor={UI_TOKENS.COLORS.whiteAlpha30}
      bg={UI_TOKENS.COLORS.panelBg}
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
        <Flex align="center" justify="flex-start" h="100%">
          <HStack gap="2">
            <Image
              src="/images/knight1.webp"
              alt="序の紋章III Knight"
              boxSize="8"
              objectFit="contain"
              filter={UI_TOKENS.FILTERS.dropShadowSoft}
            />
            <Heading
              fontSize="xl"
              fontWeight={800}
              lineHeight={1}
              letterSpacing="0.02em"
              color={UI_TOKENS.COLORS.textBase}
              textShadow={UI_TOKENS.TEXT_SHADOWS.soft}
              fontFamily="'Hiragino Kaku Gothic ProN', 'Noto Sans CJK JP', 'Yu Gothic', YuGothic, 'Meiryo UI', Meiryo, 'MS PGothic', sans-serif"
              css={{
                WebkitTextStroke: `0.5px ${UI_TOKENS.COLORS.whiteAlpha30}`,
                filter: UI_TOKENS.FILTERS.dropShadowSoft
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
