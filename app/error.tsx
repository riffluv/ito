"use client";
import { useEffect, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { logError } from "@/lib/utils/log";
import { SafeUpdateRecovery, useSafeUpdateStatus } from "@/components/ui/SafeUpdateRecovery";
import { Box, Container, Heading, Stack, Text } from "@chakra-ui/react";
import { useTransition } from "@/components/ui/TransitionProvider";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const transition = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);
  const {
    shouldShow: safeUpdateVisible,
    hasError: safeUpdateHasError,
    hydrated: safeUpdateHydrated,
  } = useSafeUpdateStatus();
  const safeUpdateActive = safeUpdateVisible && !safeUpdateHasError;
  const safeUpdateHandledRef = useRef(false);

  useEffect(() => {
    logError("app", "route-error", error);
  }, [error]);

  useEffect(() => {
    if (safeUpdateActive) {
      safeUpdateHandledRef.current = true;
    } else if (safeUpdateHandledRef.current && !safeUpdateVisible) {
      safeUpdateHandledRef.current = false;
      reset();
    }
  }, [safeUpdateActive, safeUpdateVisible, reset]);

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
          {safeUpdateHydrated && (!safeUpdateActive || safeUpdateHasError) && (
            <>
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
                <AppButton
                  onClick={handleBackToLobby}
                  disabled={isNavigating}
                  visual="outline"
                  palette="gray"
                  w={{ base: "full", sm: "auto" }}
                >
                  メインメニューに もどる
                </AppButton>
              </Stack>
            </>
          )}
          <SafeUpdateRecovery reason="error:route" />
        </Stack>
      </Box>
    </Container>
  );
}
