"use client";
import { AppButton } from "@/components/ui/AppButton";
import { Container, Stack, Text } from "@chakra-ui/react";
import { useTransition } from "@/components/ui/TransitionProvider";
import { useState } from "react";

type RoomPageError = Error & { digest?: string };

export default function RoomError({
  error,
  reset,
}: {
  error: RoomPageError;
  reset: () => void;
}) {
  const transition = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);
  const message = error?.message ?? "予期しないエラーが発生しました";

  const handleBackToLobby = async () => {
    if (isNavigating) return;
    setIsNavigating(true);

    try {
      await transition.navigateWithTransition(
        "/",
        {
          direction: "fade",
          duration: 1.0,
          showLoading: true,
          loadingSteps: [
            { id: "exit", message: "ロビーへ戻ります...", duration: 1200 },
          ],
        }
      );
    } catch (error) {
      console.error("Navigation error:", error);
      setIsNavigating(false);
    }
  };

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
          <AppButton onClick={handleBackToLobby} disabled={isNavigating}>
            ロビーへ戻る
          </AppButton>
        </Stack>
      </Stack>
    </Container>
  );
}
