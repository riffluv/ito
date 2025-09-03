"use client";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";
import { ThemePresetProvider } from "@/context/ThemePresetContext";
import system from "@/theme";
import { Box, ChakraProvider } from "@chakra-ui/react";
import { useEffect } from "react";

function DarkModeOnlyBridge() {
  // ダークモード1本集中 - data-theme を dark に固定
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    // ダークモード固定
    el.classList.add("dark");
    el.setAttribute("data-theme", "dark");
  }, []);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={system}>
      {/* next-themes を完全除去 - ダークモード固定 */}
      <ThemePresetProvider>
        <AuthProvider>
          <Box bg="canvasBg" color="fgDefault" h="100dvh">
            <DarkModeOnlyBridge />
            {children}
            <Toaster />
          </Box>
        </AuthProvider>
      </ThemePresetProvider>
    </ChakraProvider>
  );
}
