import {
  Box,
  Button,
  Link as ChakraLink,
  Container,
  Flex,
  HStack,
  Heading,
} from "@chakra-ui/react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  return (
    <Box
      as="header"
      position="sticky"
      top={0}
      zIndex="overlay"
      borderBottomWidth="1px"
      borderColor="gray.200"
    >
      <Container maxW="6xl" py={3}>
        <Flex align="center" justify="space-between">
          <HStack gap="3">
            <Box
              boxSize="6"
              bgGradient="linear(to-br, brand.400, cyan.400)"
              rounded="md"
            />
            <Heading size="md">Online ITO</Heading>
          </HStack>
          <HStack gap={2}>
            <Button asChild variant="ghost">
              <Link href="/">プレイ</Link>
            </Button>
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
