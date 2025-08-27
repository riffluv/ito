"use client";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";
import { ThemePresetProvider } from "@/context/ThemePresetContext";
import system from "@/theme";
import { Box, ChakraProvider } from "@chakra-ui/react";
import { useEffect } from "react";

function LightModeOnlyBridge() {
  // ライトモード1本集中 - data-theme を light に固定
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.documentElement;
    // ライトモード固定
    el.classList.remove("dark");
    el.setAttribute("data-theme", "light");
  }, []);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={system}>
      {/* next-themes を完全除去 - ライトモード固定 */}
      <ThemePresetProvider>
        <AuthProvider>
          <Box bg="canvasBg" color="fgDefault" minH="100vh">
            <LightModeOnlyBridge />
            {children}
            <Toaster />
          </Box>
        </AuthProvider>
      </ThemePresetProvider>
    </ChakraProvider>
  );
}
