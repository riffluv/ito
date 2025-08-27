"use client";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";
import { ThemePresetProvider } from "@/context/ThemePresetContext";
import system from "@/theme";
import { Box, ChakraProvider } from "@chakra-ui/react";
import { ThemeProvider } from "next-themes";
import { useTheme } from "next-themes";
import { useEffect } from "react";

function ThemeBridge() {
  // next-themes は attribute="data-theme" で data-theme を付与しますが、
  // 一部のスタイル/外部ライブラリ互換のため .dark クラスも同期して付与しておきます。
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const isDark = resolvedTheme === "dark";
    const el = document.documentElement;
    // mirror class
    el.classList.toggle("dark", isDark);
    // ensure data-theme is set (safety)
    el.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [resolvedTheme]);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
        <ThemePresetProvider>
          <AuthProvider>
            <Box bg="canvasBg" color="fgDefault" minH="100vh">
              <ThemeBridge />
              {children}
              <Toaster />
            </Box>
          </AuthProvider>
        </ThemePresetProvider>
      </ThemeProvider>
    </ChakraProvider>
  );
}
