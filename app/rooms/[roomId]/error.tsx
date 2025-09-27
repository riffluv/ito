"use client";
import { AppButton } from "@/components/ui/AppButton";
import { Container, Stack, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

type RoomPageError = Error & { digest?: string };

export default function RoomError({
  error,
  reset,
}: {
  error: RoomPageError;
  reset: () => void;
}) {
  const router = useRouter();
  const message = error?.message ?? "予期しないエラーが発生しました";
  return (
    <Container
      maxW="container.md"
      h="100dvh"
      py={6}
      display="flex"
      alignItems="center"
      justifyContent="center"
    >
      <Stack gap={3}>
        <Text fontWeight="bold">エラーが発生しました</Text>
        <Text fontSize="sm" color="fgMuted">
          {message}
        </Text>
        <Stack direction="row">
          <AppButton onClick={() => reset()}>再読み込み</AppButton>
          <AppButton onClick={() => router.push("/")}>ロビーへ戻る</AppButton>
        </Stack>
      </Stack>
    </Container>
  );
}
