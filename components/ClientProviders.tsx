"use client";
import AuthClientWrapper from "@/components/AuthClientWrapper";
import { DragonQuestNotifyContainer } from "@/components/ui/DragonQuestNotify";
import system from "@/theme";
import { Box, ChakraProvider } from "@chakra-ui/react";
import React, { useEffect } from "react";
import { AnimationProvider } from "@/lib/animation/AnimationContext";

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
      <AnimationProvider>
        <Box bg="canvasBg" color="fgDefault" h="100dvh">
          <DarkModeOnlyBridge />
          <AuthClientWrapper>{children}</AuthClientWrapper>
          <DragonQuestNotifyContainer />
        </Box>
      </AnimationProvider>
    </ChakraProvider>
  );
}
