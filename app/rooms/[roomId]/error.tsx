"use client";
import { Button, Container, Stack, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";

export default function RoomError({ error, reset }: { error: any; reset: () => void }) {
  const router = useRouter();
  return (
    <Container maxW="container.md" h="100dvh" py={6} display="flex" alignItems="center" justifyContent="center">
      <Stack spacing={3}>
        <Text fontWeight="bold">エラーが発生しました</Text>
        <Text fontSize="sm" color="gray.300">{String(error?.message || error)}</Text>
        <Stack direction="row">
          <Button onClick={() => reset()}>再読み込み</Button>
          <Button onClick={() => router.push("/")}>ロビーへ戻る</Button>
        </Stack>
      </Stack>
    </Container>
  );
}

