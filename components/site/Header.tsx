"use client";
import { DevPresetSwitcher } from "@/components/DevPresetSwitcher";
import { Box, Container, Flex, HStack, Heading } from "@chakra-ui/react";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

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
          <HStack gap={4}>
            <DevPresetSwitcher compact />
            <ThemeToggle />
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}
