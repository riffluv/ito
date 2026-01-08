"use client";

import { scaleForDpi } from "@/components/ui/scaleForDpi";
import { Box, Text } from "@chakra-ui/react";
import React from "react";
import { HD2DLoadingSpinner } from "../HD2DLoadingSpinner";

type QuickStartProgressIndicatorProps = {
  show: boolean;
  text: string | null | undefined;
};

export function QuickStartProgressIndicator(
  props: QuickStartProgressIndicatorProps
) {
  const { show, text } = props;
  if (!show) return null;

  return (
    <Box
      position="fixed"
      bottom={{
        base: "clamp(120px, 18vh, 220px)",
        md: "clamp(130px, 16vh, 240px)",
      }}
      left="50%"
      transform="translateX(-50%)"
      zIndex={56}
      pointerEvents="none"
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap="10px"
    >
      <HD2DLoadingSpinner size={scaleForDpi("38px")} />

      <Text
        fontSize="0.85rem"
        fontWeight="600"
        color="rgba(255, 248, 225, 0.92)"
        letterSpacing="0.06em"
        fontFamily="monospace"
        textShadow={`
          0 1px 3px rgba(0, 0, 0, 0.9),
          0 2px 6px rgba(0, 0, 0, 0.7),
          0 0 12px rgba(255, 240, 200, 0.12)
        `}
        css={{
          animation: "subtleFloat 2.8s cubic-bezier(.4,.15,.6,.85) infinite",
          "@keyframes subtleFloat": {
            "0%, 100%": { transform: "translateY(0)" },
            "50%": { transform: "translateY(-1.5px)" },
          },
        }}
      >
        {text ?? ""}
      </Text>
    </Box>
  );
}
