"use client";
import { AppButton } from "@/components/ui/AppButton";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Container, Flex, HStack, Heading } from "@chakra-ui/react";
import Link from "next/link";
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
      borderColor="borderDefault"
      bg="panelBg"
      /* インラインbackdrop除去 → シンプルなフラットヘッダー */
      h={{ base: "56px", md: "64px" }}
      display="flex"
      alignItems="center"
      css={{
        "--unified-header-height": UNIFIED_LAYOUT.HEADER_HEIGHT,
        // 125% DPI最適化
        [`@media ${UNIFIED_LAYOUT.MEDIA_QUERIES.DPI_125}`]: {
          "--unified-header-height": UNIFIED_LAYOUT.DPI_125.HEADER_HEIGHT,
          height: UNIFIED_LAYOUT.DPI_125.HEADER_HEIGHT,
        },
      }}
    >
      <Container maxW="6xl" px={3}>
        <Flex align="center" justify="space-between" h="100%">
          <HStack gap="2">
            <Box boxSize="5" bgGradient="accentSoft" rounded="md" />
            <Heading
              fontSize={{ base: "1.05rem", md: "1.15rem" }}
              lineHeight={1}
              letterSpacing="tight"
            >
              Online ITO
            </Heading>
          </HStack>
          <HStack gap={4}>
            <AppButton variant="subtle" as={Link} href="/rules">
              ルール
            </AppButton>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}
