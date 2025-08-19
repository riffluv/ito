"use client";
import {
  Box,
  Container,
  Flex,
  HStack,
  Heading,
  IconButton,
  Button,
  useColorMode,
  useColorModeValue,
  Link as ChakraLink,
} from "@chakra-ui/react";
import { MoonIcon, SunIcon } from "@chakra-ui/icons";
import Link from "next/link";

export default function Header() {
  const { colorMode, toggleColorMode } = useColorMode();
  const bg = useColorModeValue("white", "gray.900");
  const border = useColorModeValue("gray.200", "whiteAlpha.200");
  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex="overlay"
      bg={bg}
      borderBottomWidth="1px"
      borderColor={border}
    >
      <Container maxW="6xl" py={3}>
        <Flex align="center" justify="space-between">
          <HStack spacing="3">
            <Box boxSize="6" bgGradient="linear(to-br, brand.400, cyan.400)" rounded="md" />
            <Heading size="md">Online ITO</Heading>
          </HStack>
          <HStack spacing={2}>
            <Button as={Link} href="/" variant="ghost">プレイ</Button>
            <ChakraLink
              as={Link}
              href="/"
              prefetch={false}
              display={{ base: "none", md: "inline-flex" }}
            >
              Docs
            </ChakraLink>
            <IconButton
              aria-label="カラーモード切替"
              onClick={toggleColorMode}
              icon={colorMode === "light" ? <MoonIcon /> : <SunIcon />}
              variant="ghost"
            />
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}

