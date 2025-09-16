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
        bg="rgba(6,8,12,0.88)"
        border="2px solid rgba(255,255,255,0.12)"
        borderRadius="16px"
        p={{ base: 6, md: 8 }}
        boxShadow="0 20px 45px rgba(0,0,0,0.45)"
      >
        <Stack gap={4}>
          <Heading size="md" color="white">
            予期しないエラーが発生しました
          </Heading>
          <Text color="rgba(255,255,255,0.78)">
            申し訳ありません。操作を再試行するか、ロビーに戻ってください。
          </Text>
          <Box bg="rgba(0,0,0,0.35)" borderRadius="12px" p={4}>
            <Text fontSize="xs" color="rgba(255,255,255,0.6)">
              {error.message || "Unknown error"}
            </Text>
            {error.digest && (
              <Text fontSize="xs" color="rgba(255,255,255,0.4)" mt={2}>
                エラーID: {error.digest}
              </Text>
            )}
          </Box>
          <Stack direction={{ base: "column", sm: "row" }} gap={3}>
            <AppButton onClick={() => reset()} colorPalette="blue">
              再試行する
            </AppButton>
            <Link href="/">
              <AppButton variant="outline" w="full">
                ロビーに戻る
              </AppButton>
            </Link>
          </Stack>
        </Stack>
      </Box>
    </Container>
  );
}
