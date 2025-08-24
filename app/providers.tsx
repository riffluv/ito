"use client";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/context/AuthContext";
import { ThemePresetProvider } from "@/context/ThemePresetContext";
import system from "@/theme";
import { Box, ChakraProvider } from "@chakra-ui/react";
import { ThemeProvider } from "next-themes";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <ThemeProvider attribute="class">
        <ThemePresetProvider>
          <AuthProvider>
            <Box
              bg="canvasBg"
              color="fgDefault"
              minH="100dvh"
              _dark={{ bg: "canvasBg", color: "fgDefault" }}
            >
              {children}
              <Toaster />
            </Box>
          </AuthProvider>
        </ThemePresetProvider>
      </ThemeProvider>
    </ChakraProvider>
  );
}
