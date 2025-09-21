"use client";
import { useEffect } from "react";
import Link from "next/link";
import { AppButton } from "@/components/ui/AppButton";
import { logError } from "@/lib/utils/log";
import { Box, Container, Heading, Stack, Text } from "@chakra-ui/react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError("app", "route-error", error);
  }, [error]);

  return (
    <Container maxW="container.sm" py={16}>
      <Box
        bg="bgPanel"
        border="borders.retrogame"
        borderColor="whiteAlpha.90"
        borderRadius={0}
        p={{ base: 6, md: 8 }}
        boxShadow="2px 2px 0 rgba(0,0,0,0.8), 4px 4px 0 rgba(0,0,0,0.6)"
      >
        <Stack gap={4}>
          <Heading
            size="md"
            color="white"
            fontFamily="monospace"
            textShadow="1px 1px 0px #000"
            letterSpacing="0.5px"
          >
            システムエラーが 発生しました
          </Heading>
          <Text
            color="whiteAlpha.90"
            fontFamily="monospace"
            textShadow="1px 1px 0px rgba(0,0,0,0.6)"
            lineHeight="1.6"
          >
            システムが 不具合です。再試行するか、メインメニューに もどってください。
          </Text>
          <Box
            bg="bgSubtle"
            borderRadius={0}
            p={4}
            border="borders.retrogameThin"
            borderColor="whiteAlpha.60"
            boxShadow="1px 1px 0 rgba(0,0,0,0.6)"
          >
            <Text
              fontSize="xs"
              color="whiteAlpha.80"
              fontFamily="monospace"
              textShadow="1px 1px 0px rgba(0,0,0,0.6)"
            >
              {error.message || "システムエラー"}
            </Text>
            {error.digest && (
              <Text
                fontSize="xs"
                color="whiteAlpha.60"
                mt={2}
                fontFamily="monospace"
                textShadow="1px 1px 0px rgba(0,0,0,0.6)"
              >
                エラーID: {error.digest}
              </Text>
            )}
          </Box>
          <Stack direction={{ base: "column", sm: "row" }} gap={3}>
            <AppButton
              onClick={() => reset()}
              visual="solid"
              palette="brand"
            >
              もういちど やりなおす
            </AppButton>
            <Link href="/">
              <AppButton
                visual="outline"
                palette="gray"
                w="full"
              >
                メインメニューに もどる
              </AppButton>
            </Link>
          </Stack>
        </Stack>
      </Box>
    </Container>
  );
}
