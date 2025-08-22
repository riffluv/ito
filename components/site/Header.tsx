"use client";
import { AppButton } from "@/components/ui/AppButton";
import {
  Box,
  Link as ChakraLink,
  Container,
  Flex,
  HStack,
  Heading,
} from "@chakra-ui/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
const ThemeToggle = dynamic(() => import("./ThemeToggle"), { ssr: false });

export default function Header() {
  const pathname = usePathname();
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
    >
      <Container maxW="6xl" py={3}>
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
          <HStack gap={2}>
            <AppButton
              asChild
              variant={isHome ? "solid" : "subtle"}
              aria-label="プレイページへ"
            >
              <Link href="/">プレイ</Link>
            </AppButton>
            <ChakraLink asChild display={{ base: "none", md: "inline-flex" }}>
              <Link href="/">Docs</Link>
            </ChakraLink>
            <ThemeToggle />
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}
