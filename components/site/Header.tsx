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
      borderBottomWidth="2px"
      borderColor="rgba(255,255,255,0.2)"
      bg="rgba(12,14,20,0.92)"
      backdropFilter="blur(12px)"
      h="64px"
      display="flex"
      alignItems="center"
      css={{
        "--unified-header-height": UNIFIED_LAYOUT.HEADER_HEIGHT,
        boxShadow: "0 2px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
        background: "linear-gradient(180deg, rgba(12,14,20,0.95) 0%, rgba(8,10,16,0.92) 100%)",
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
          "--unified-header-height": UNIFIED_LAYOUT.DPI_125.HEADER_HEIGHT,
          height: UNIFIED_LAYOUT.DPI_125.HEADER_HEIGHT,
        },
      }}
    >
      <Container maxW="5xl" px={6}>
        <Flex align="center" justify="center" h="100%">
          <HStack gap="3">
            <Image
              src="/images/card3.webp"
              alt="序の紋章III Card"
              boxSize="9"
              objectFit="contain"
              css={{
                filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.8))",
              }}
            />
            <Heading
              fontSize="22px"
              fontWeight={700}
              lineHeight={1}
              letterSpacing="0.05em"
              color="rgba(255,255,255,0.95)"
              textShadow="0 2px 4px rgba(0,0,0,0.8), 0 0 12px rgba(255,255,255,0.15)"
              fontFamily="'Hiragino Kaku Gothic ProN', 'Noto Sans CJK JP', 'Yu Gothic', YuGothic, 'Meiryo UI', Meiryo, 'MS PGothic', sans-serif"
            >
              序の紋章III
            </Heading>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}
