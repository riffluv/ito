"use client";
import { AppButton } from "@/components/ui/AppButton";
import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";

export default function CompareClient({ slug, html }: { slug: string; html: string }) {
  const [mode, setMode] = useState<"split" | "ref" | "app">("split");

  const sanitized = useMemo(() => html, [html]);

  return (
    <Stack gap={4}>
      <HStack justify="space-between" align="center">
        <Text fontWeight="bold">Design Compare: {slug}</Text>
        <HStack>
          <AppButton size="sm" variant={mode === "split" ? "solid" : "outline"} onClick={() => setMode("split")}>Split</AppButton>
          <AppButton size="sm" variant={mode === "ref" ? "solid" : "outline"} onClick={() => setMode("ref")}>Reference</AppButton>
          <AppButton size="sm" variant={mode === "app" ? "solid" : "outline"} onClick={() => setMode("app")}>App</AppButton>
        </HStack>
      </HStack>

      {mode === "split" && (
        <HStack align="start" gap={6}>
          <Box flex={1} p={4} bg="panelBg" borderWidth="1px" borderColor="borderDefault" rounded="lg">
            <Text fontSize="sm" color="fgMuted" mb={2}>Reference (HTML)</Text>
            <Box
              rounded="md"
              p={3}
              bg="panelSubBg"
              borderWidth="1px"
              borderColor="borderDefault"
              // Render raw HTML inside same document to inherit tokens and color-mode
              dangerouslySetInnerHTML={{ __html: sanitized }}
            />
          </Box>
          <Box flex={1} p={4} bg="panelBg" borderWidth="1px" borderColor="borderDefault" rounded="lg">
            <Text fontSize="sm" color="fgMuted" mb={2}>App (Chakra)</Text>
            <Box rounded="md" p={3} bg="panelSubBg" borderWidth="1px" borderColor="borderDefault">
              <Text fontSize="sm" color="fgMuted">ここに対応するChakra実装を配置します。</Text>
            </Box>
          </Box>
        </HStack>
      )}

      {mode === "ref" && (
        <Box p={4} bg="panelBg" borderWidth="1px" borderColor="borderDefault" rounded="lg">
          <Box rounded="md" p={3} bg="panelSubBg" borderWidth="1px" borderColor="borderDefault" dangerouslySetInnerHTML={{ __html: sanitized }} />
        </Box>
      )}

      {mode === "app" && (
        <Box p={4} bg="panelBg" borderWidth="1px" borderColor="borderDefault" rounded="lg">
          <Box rounded="md" p={3} bg="panelSubBg" borderWidth="1px" borderColor="borderDefault">
            <Text fontSize="sm" color="fgMuted">ここに対応するChakra実装を配置します。</Text>
          </Box>
        </Box>
      )}
    </Stack>
  );
}

