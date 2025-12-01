"use client";
import AuthClientWrapper from "@/components/AuthClientWrapper";
import AuthSessionHeartbeat from "@/components/AuthSessionHeartbeat";
import { DragonQuestNotifyContainer } from "@/components/ui/DragonQuestNotify";
import SafeUpdateBanner from "@/components/ui/SafeUpdateBanner";
import { TransitionProvider } from "@/components/ui/TransitionProvider";
import { PixiHudStage } from "@/components/ui/pixi/PixiHudStage";
import system from "@/theme";
import { Box, ChakraProvider } from "@chakra-ui/react";
import React from "react";
import { AnimationProvider } from "@/lib/animation/AnimationContext";
import { SoundProvider } from "@/lib/audio/SoundProvider";
import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // HUD を使うのはルーム系画面のみ。ロビーなどでは Pixi を初期化しない。
  const hudEnabled =
    typeof pathname === "string" &&
    (pathname.startsWith("/rooms/") || pathname.startsWith("/r/"));

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <ChakraProvider value={system}>
        <SoundProvider>
          <AnimationProvider>
            <TransitionProvider>
              <PixiHudStage zIndex={105} enabled={hudEnabled}>
                <Box bg="canvasBg" color="fgDefault" h="100dvh">
                  <SafeUpdateBanner />
                  <AuthClientWrapper>
                    <AuthSessionHeartbeat />
                    {children}
                  </AuthClientWrapper>
                  <DragonQuestNotifyContainer />
                </Box>
              </PixiHudStage>
            </TransitionProvider>
          </AnimationProvider>
        </SoundProvider>
      </ChakraProvider>
    </ThemeProvider>
  );
}
