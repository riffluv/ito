"use client";
import { UNIFIED_LAYOUT } from "@/theme/layout";
import { Box, Container, Flex, HStack, Heading } from "@chakra-ui/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";
import { AppButton } from "@/components/ui/AppButton";

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
      style={{ backdropFilter: "saturate(180%) blur(8px)" }}
      h={UNIFIED_LAYOUT.HEADER_HEIGHT}
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
      <Container maxW="6xl" px={4}>
        <Flex align="center" justify="space-between">
          <HStack gap="3">
            <Box
              boxSize="6"
              bgGradient="linear(to-br, brand.400, cyan.400)"
              rounded="md"
            />
            <Heading size="lg" letterSpacing="tight">
              Online ITO
            </Heading>
          </HStack>
          <HStack gap={4}>
            <AppButton variant="subtle" as={Link} href="/rules">
              ルール
            </AppButton>
            <ThemeToggle />
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}
