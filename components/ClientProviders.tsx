"use client";
import AuthClientWrapper from "@/components/AuthClientWrapper";
import { DragonQuestNotifyContainer } from "@/components/ui/DragonQuestNotify";
import { TransitionProvider } from "@/components/ui/TransitionProvider";
import { PixiHudStage } from "@/components/ui/pixi/PixiHudStage";
import system from "@/theme";
import { Box, ChakraProvider } from "@chakra-ui/react";
import React, { useEffect } from "react";
import { AnimationProvider } from "@/lib/animation/AnimationContext";
import { SoundProvider } from "@/lib/audio/SoundProvider";

function DarkModeOnlyBridge() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    el.classList.add("dark");
    el.setAttribute("data-theme", "dark");
  }, []);
  return null;
}

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChakraProvider value={system}>
      <SoundProvider>
        <AnimationProvider>
          <TransitionProvider>
            <PixiHudStage zIndex={105}>
              <Box bg="canvasBg" color="fgDefault" h="100dvh">
                <DarkModeOnlyBridge />
                <AuthClientWrapper>{children}</AuthClientWrapper>
                <DragonQuestNotifyContainer />
              </Box>
            </PixiHudStage>
          </TransitionProvider>
        </AnimationProvider>
      </SoundProvider>
    </ChakraProvider>
  );
}
